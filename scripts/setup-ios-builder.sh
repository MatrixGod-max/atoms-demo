#!/usr/bin/env bash
# Fusion iOS 构建机环境检查/安装。在平台本机执行:
#   NATIVE_BUILD_IOS_HOST=jing@10.234.201.128 bash scripts/setup-ios-builder.sh
# 要求:macOS ≥ 13 + Xcode ≥ 15(Capacitor iOS 硬性要求)。不满足时输出明确报告并以非零退出,
# 平台侧保持 iOS「准备中」。满足后本脚本会安装 node/CocoaPods 依赖并写入 build-ios.sh(未签名 ipa)。
set -euo pipefail

HOST="${NATIVE_BUILD_IOS_HOST:-jing@10.234.201.128}"
echo "== 检查 iOS 构建机: $HOST"

REPORT=$(ssh -o ConnectTimeout=10 "$HOST" '
  echo "hostname=$(hostname)"
  echo "macos=$(sw_vers -productVersion 2>/dev/null || echo none)"
  echo "xcode=$(xcodebuild -version 2>/dev/null | head -1 || echo none)"
  echo "node=$(node -v 2>/dev/null || echo none)"
  echo "disk=$(df -h / | tail -1 | awk "{print \$4}")"
' 2>/dev/null) || { echo "✗ 无法 ssh 到 $HOST"; exit 1; }
echo "$REPORT"

MACOS=$(echo "$REPORT" | sed -n 's/^macos=//p')
XCODE=$(echo "$REPORT" | sed -n 's/^xcode=//p')
MAJOR=${MACOS%%.*}

if [ "$MACOS" = "none" ] || [ "${MAJOR:-0}" -lt 13 ]; then
  cat <<EOF
✗ 环境不满足:macOS $MACOS(需要 ≥ 13 Ventura 才能安装 Xcode 15+)
  该构建机无法承载现代 iOS 构建(Capacitor 要求 Xcode 15+ / iOS 17 SDK)。
  处置建议:升级/更换 Mac 后重跑本脚本;期间平台 iOS 打包保持「准备中」,
  用户可用「导出工程」(内含 Capacitor 配置)在自有 Mac 上构建。
EOF
  exit 2
fi
if ! echo "$XCODE" | grep -qE 'Xcode (1[5-9]|[2-9][0-9])'; then
  echo "✗ 环境不满足:未检测到 Xcode 15+(当前:$XCODE)。请在构建机安装 Xcode 后重跑。"
  exit 3
fi

echo "== 环境满足,安装构建脚本(未签名 archive + ipa)"
ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
BASE="$HOME/fusion-ios"
mkdir -p "$BASE/ws"
command -v node >/dev/null || { echo "需要 node ≥20(建议 brew install node@20)"; exit 1; }
cat > "$BASE/build-ios.sh" <<'EOF'
#!/usr/bin/env bash
# 用法: build-ios.sh <buildId> <appId> <appName>
# 前置: ws/<buildId>/upload/ 为 web 工程(dist 已构建或含 index.html)
set -euo pipefail
BASE="$HOME/fusion-ios"; ID="$1"; APP_ID="$2"; APP_NAME="$3"
WS="$BASE/ws/$ID"; cd "$WS/upload"
npm install --no-audit --no-fund @capacitor/core @capacitor/cli @capacitor/ios
[ -d dist ] || { mkdir -p dist && cp index.html dist/; }
printf '{ "appId": "%s", "appName": "%s", "webDir": "dist" }\n' "$APP_ID" "$APP_NAME" > capacitor.config.json
npx cap add ios || true
npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -archivePath "$WS/App.xcarchive" archive CODE_SIGNING_ALLOWED=NO
cd "$WS/App.xcarchive/Products/Applications" && mkdir -p ../../Payload && cp -r App.app ../../Payload/
cd "$WS/App.xcarchive/Products" && zip -qry "$WS/app-unsigned.ipa" ../../Payload
echo "IPA_PATH=$WS/app-unsigned.ipa(未签名:需自行签名或经 Xcode 安装)"
EOF
chmod +x "$BASE/build-ios.sh"
echo "== iOS 构建脚本就绪: ~/fusion-ios/build-ios.sh"
REMOTE
echo "== 完成。平台侧配置 NATIVE_BUILD_IOS_HOST=$HOST 即启用 iOS 打包入口"
