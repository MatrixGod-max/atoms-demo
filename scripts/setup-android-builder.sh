#!/usr/bin/env bash
# Fusion Android 构建机一次性安装(幂等)。在平台本机执行,所有远程操作经 ssh 驱动:
#   NATIVE_BUILD_HOST=ubuntu@10.234.201.214 bash scripts/setup-android-builder.sh
# 产出(214 上):
#   ~/fusion-android/jdk        用户级 Temurin JDK21(Capacitor 7 要求;不碰系统 java,现有服务不受影响)
#   ~/fusion-android/sdk        Android SDK(platform-tools / android-35 / build-tools 35)
#   ~/fusion-android/template   预热模板(node_modules + android 工程 + 已跑通一次 assembleDebug)
#   ~/fusion-android/build.sh   单次构建入口(平台 nativeBuild.ts 调用)
# 网络:Tsinghua Adoptium 镜像 + npmmirror;dl.google.com/gradle/maven 经 214 本地代理 127.0.0.1:7890
set -euo pipefail

HOST="${NATIVE_BUILD_HOST:-ubuntu@10.234.201.214}"
echo "== 安装目标: $HOST(全程 ssh 驱动,日志同时落远端 ~/fusion-android/setup.log)"

ssh "$HOST" 'bash -s' <<'REMOTE' 2>&1 | tee /dev/stderr | tail -5 >/dev/null
set -euo pipefail
BASE="$HOME/fusion-android"
mkdir -p "$BASE"/{ws,out}
exec > >(tee -a "$BASE/setup.log") 2>&1
echo "== setup start $(date -Is)"

export http_proxy=http://127.0.0.1:7890 https_proxy=http://127.0.0.1:7890
export HTTP_PROXY=$http_proxy HTTPS_PROXY=$https_proxy
export GRADLE_OPTS="-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=7890 -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=7890"

# ---- 1. 用户级 JDK 21(Tsinghua Adoptium 镜像,免代理)----
if ! "$BASE/jdk/bin/java" -version 2>&1 | grep -q 'version "21'; then
  echo "== 安装 JDK 21(用户级,不改系统 java;Capacitor 7 的 android 库要求 Java 21)"
  MIRROR="https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jdk/x64/linux"
  TARBALL=$(curl -fsS --noproxy '*' "$MIRROR/" | grep -o 'OpenJDK21U-jdk_x64_linux_hotspot_[^"]*\.tar\.gz' | sort -uV | tail -1)
  [ -n "$TARBALL" ] || { echo "无法解析 JDK21 包名"; exit 1; }
  curl -fsSL --noproxy '*' -o /tmp/jdk21.tar.gz "$MIRROR/$TARBALL"
  mkdir -p "$BASE/jdk.tmp" && tar xzf /tmp/jdk21.tar.gz -C "$BASE/jdk.tmp" --strip-components=1
  rm -rf "$BASE/jdk" && mv "$BASE/jdk.tmp" "$BASE/jdk" && rm -f /tmp/jdk21.tar.gz
fi
export JAVA_HOME="$BASE/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
java -version 2>&1 | head -1

# ---- 2. Android SDK(cmdline-tools + sdkmanager,经代理)----
SDKM="$BASE/sdk/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$SDKM" ]; then
  echo "== 安装 Android cmdline-tools"
  curl -fsSL -o /tmp/cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  mkdir -p "$BASE/sdk/cmdline-tools"
  rm -rf "$BASE/sdk/cmdline-tools/latest" /tmp/cmdtools-unzip
  mkdir -p /tmp/cmdtools-unzip && unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools-unzip
  mv /tmp/cmdtools-unzip/cmdline-tools "$BASE/sdk/cmdline-tools/latest"
  rm -rf /tmp/cmdtools.zip /tmp/cmdtools-unzip
fi
export ANDROID_HOME="$BASE/sdk"
if [ ! -d "$BASE/sdk/platforms/android-35" ]; then
  echo "== 安装 SDK 组件(platform-tools / android-35 / build-tools 35)"
  # `yes` 在 sdkmanager 退出后必收 SIGPIPE;pipefail 下需局部豁免
  set +o pipefail
  yes | "$SDKM" --sdk_root="$ANDROID_HOME" --licenses >/dev/null
  set -o pipefail
  "$SDKM" --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-35" "build-tools;35.0.0" | grep -v "^\[" || true
  [ -d "$BASE/sdk/platforms/android-35" ] || { echo "SDK 组件安装失败"; exit 1; }
fi

# ---- 3. 预热模板(样例工程完整跑通一次:npm install → cap add → gradle assembleDebug)----
if [ ! -f "$BASE/template/android/app/build/outputs/apk/debug/app-debug.apk" ]; then
  echo "== 预热构建模板(首次含 gradle 发行版与依赖下载,约 10-25 分钟)"
  rm -rf "$BASE/template" && mkdir -p "$BASE/template/src" && cd "$BASE/template"
  cat > .npmrc <<'EOF'
registry=https://registry.npmmirror.com
EOF
  cat > package.json <<'EOF'
{
  "name": "fusion-native-template",
  "private": true,
  "type": "module",
  "scripts": { "build": "vite build" },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@capacitor/core": "^7.0.0",
    "@capacitor/android": "^7.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^7.0.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
EOF
  cat > vite.config.js <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
EOF
  cat > index.html <<'EOF'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fusion Template</title></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
EOF
  cat > src/main.jsx <<'EOF'
import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")).render(<h1>Fusion</h1>);
EOF
  cat > capacitor.config.json <<'EOF'
{ "appId": "dev.fusion.template", "appName": "FusionTemplate", "webDir": "dist" }
EOF
  npm install --no-audit --no-fund
  npx vite build
  npx cap add android
  # JDK 更换后旧 daemon 会以旧 JVM 驻留;构建前统一清掉
  ( cd android && (./gradlew --stop >/dev/null 2>&1 || true) && ./gradlew assembleDebug )
  echo "== 模板预热完成"
fi

# ---- 4. 单次构建脚本 ----
cat > "$BASE/build.sh" <<'BUILDEOF'
#!/usr/bin/env bash
# 用法: build.sh <buildId> <appId> <appName> <engine single|project>
# 前置: 调用方已把工程源文件解包到 ~/fusion-android/ws/<buildId>/upload/
set -euo pipefail
BASE="$HOME/fusion-android"
ID="$1"; APP_ID="$2"; APP_NAME="$3"; ENGINE="$4"
WS="$BASE/ws/$ID"
[ -d "$WS/upload" ] || { echo "缺少上传目录 $WS/upload"; exit 1; }
export JAVA_HOME="$BASE/jdk"
export ANDROID_HOME="$BASE/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export http_proxy=http://127.0.0.1:7890 https_proxy=http://127.0.0.1:7890
export GRADLE_OPTS="-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=7890 -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=7890"

echo "== [1/4] 克隆预热模板(硬链接)"
rsync -a --link-dest="$BASE/template/" "$BASE/template/" "$WS/app/"
cd "$WS/app"
# 硬链接克隆后,任何“原地覆盖”都会写穿模板 —— 一律先 unlink 再写入
rm -rf src dist index.html styles.css capacitor.config.json
rm -rf android/app/src/main/assets/public

echo "== [2/4] 注入用户工程并产出 web 资产(engine=$ENGINE)"
if [ "$ENGINE" = "project" ]; then
  cp "$WS/upload/index.html" index.html
  [ -d "$WS/upload/src" ] && cp -r "$WS/upload/src" src
  find "$WS/upload" -maxdepth 1 -name '*.css' -exec cp {} . \;
  npx vite build
else
  mkdir -p dist && cp "$WS/upload/index.html" dist/index.html
fi
[ -f dist/index.html ] || { echo "web 资产缺少 dist/index.html"; exit 1; }

echo "== [3/4] 写入应用标识并同步到 Android 工程"
printf '{ "appId": "%s", "appName": "%s", "webDir": "dist" }\n' "$APP_ID" "$APP_NAME" > capacitor.config.json
sed -i "s/applicationId \"[^\"]*\"/applicationId \"$APP_ID\"/" android/app/build.gradle
sed -i "s#<string name=\"app_name\">[^<]*</string>#<string name=\"app_name\">$APP_NAME</string>#" android/app/src/main/res/values/strings.xml
sed -i "s#<string name=\"title_activity_main\">[^<]*</string>#<string name=\"title_activity_main\">$APP_NAME</string>#" android/app/src/main/res/values/strings.xml || true
npx cap sync android

echo "== [4/4] gradle assembleDebug"
( cd android && ./gradlew assembleDebug )
APK="$WS/app/android/app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK" ] || { echo "APK 未产出"; exit 1; }
echo "APK_PATH=$APK"
du -h "$APK" | cut -f1
BUILDEOF
chmod +x "$BASE/build.sh"

echo "== 版本摘要"
java -version 2>&1 | head -1
"$SDKM" --sdk_root="$ANDROID_HOME" --list_installed 2>/dev/null | sed -n '1,8p' || true
ls -la "$BASE/template/android/app/build/outputs/apk/debug/" 2>/dev/null || true
echo "== setup done $(date -Is)"
REMOTE

echo "== 远端安装完成;详细日志: ssh $HOST 'tail -100 ~/fusion-android/setup.log'"
