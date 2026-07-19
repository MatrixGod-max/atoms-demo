#!/usr/bin/env bash
# Fusion Cloud(214 模拟云主机)一次性安装(幂等)。在平台本机执行,远程操作全部经 ssh:
#   bash scripts/setup-cloud-server.sh
# 产出(214 上):
#   ~/fusion-cloud/template/     vite+react 预热模板(node_modules 就绪,构建秒级起步)
#   ~/fusion-cloud/apps/{slug}/  各云实例(source + dist)
#   ~/fusion-cloud/build-web.sh  单实例云构建入口(含 --clean 子命令)
#   fusion-cloud.service         零依赖 node 静态托管(0.0.0.0:8070,/{slug}/* → apps/{slug}/dist)
set -euo pipefail

HOST="${CLOUD_HOST:-ubuntu@10.234.201.214}"
PORT=8070

echo "== 部署 Fusion Cloud 基座($HOST)"
ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
BASE="$HOME/fusion-cloud"
mkdir -p "$BASE/apps"
cd "$BASE"

# ---- 1. vite+react 预热模板 ----
if [ ! -d "$BASE/template/node_modules/vite" ]; then
  echo "== 预热 vite 模板(npmmirror)"
  mkdir -p "$BASE/template/src" && cd "$BASE/template"
  printf 'registry=https://registry.npmmirror.com\n' > .npmrc
  cat > package.json <<'EOF'
{
  "name": "fusion-cloud-template",
  "private": true,
  "type": "module",
  "scripts": { "build": "vite build" },
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": { "vite": "^6.0.0", "@vitejs/plugin-react": "^4.3.0" }
}
EOF
  cat > vite.config.js <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// base:"./" 让产物在 /{slug}/ 子路径下可用
export default defineConfig({ plugins: [react()], base: "./" });
EOF
  cat > index.html <<'EOF'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Fusion Cloud Template</title></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
EOF
  cat > src/main.jsx <<'EOF'
import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")).render(<h1>Fusion Cloud</h1>);
EOF
  npm install --no-audit --no-fund
  npm run build
  echo "== 模板预热完成"
  cd "$BASE"
fi

# ---- 2. 单实例构建脚本 ----
cat > "$BASE/build-web.sh" <<'BUILDEOF'
#!/usr/bin/env bash
# 用法: build-web.sh <slug>            —— 云端构建(前置:apps/<slug>/source/ 已就位)
#       build-web.sh --clean <slug>    —— 删除实例目录
set -euo pipefail
BASE="$HOME/fusion-cloud"

if [ "$1" = "--clean" ]; then
  SLUG="$2"
  [[ "$SLUG" =~ ^[a-z0-9-]+$ ]] || { echo "非法 slug"; exit 1; }
  rm -rf "$BASE/apps/$SLUG"
  echo "cleaned $SLUG"
  exit 0
fi

SLUG="$1"
[[ "$SLUG" =~ ^[a-z0-9-]+$ ]] || { echo "非法 slug"; exit 1; }
APP="$BASE/apps/$SLUG"
[ -d "$APP/source" ] || { echo "缺少 $APP/source"; exit 1; }

echo "== [1/3] 克隆构建模板(硬链接)"
rm -rf "$APP/work"
rsync -a --link-dest="$BASE/template/" "$BASE/template/" "$APP/work/"
cd "$APP/work"
# 硬链接克隆:任何原地覆盖都会写穿模板,先 unlink 再写
rm -rf src dist index.html styles.css

echo "== [2/3] 注入源码并做 vite 语义预处理"
cp "$APP/source/index.html" index.html
[ -d "$APP/source/src" ] && cp -r "$APP/source/src" src
find "$APP/source" -maxdepth 1 -name '*.css' -exec cp {} . \;
# v17 工程源码的 script 标签是 esbuild 语义(无 type=module、相对路径),vite 不打包 ——
# 统一改写为 <script type="module" src="/相对路径">
sed -i -E 's#<script[[:space:]]+src="\.?/?(src/[^"]+)"[[:space:]]*>#<script type="module" src="/\1">#g' index.html

echo "== [3/3] vite build"
npm run build
[ -f dist/index.html ] || { echo "构建产物缺少 dist/index.html"; exit 1; }
rm -rf "$APP/dist"
mv dist "$APP/dist"
echo "BUILD_OK slug=$SLUG size=$(du -sh "$APP/dist" | cut -f1)"
BUILDEOF
chmod +x "$BASE/build-web.sh"

# ---- 3. 静态托管服务(零依赖 node) ----
cat > "$BASE/server.mjs" <<'SRVEOF'
// Fusion Cloud 静态托管:/{slug}/* → apps/{slug}/dist,零依赖。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { homedir } from "node:os";

const ROOT = join(homedir(), "fusion-cloud", "apps");
const PORT = 8070;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".map": "application/json", ".txt": "text/plain",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/_health") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end('{"ok":true}');
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts.shift() ?? "";
    if (!/^[a-z0-9-]+$/.test(slug)) {
      res.writeHead(404); return res.end("not found");
    }
    const rel = normalize(parts.join("/")).replace(/^(\.\.[/\\])+/, "");
    let file = join(ROOT, slug, "dist", rel || "index.html");
    if (!file.startsWith(join(ROOT, slug))) { res.writeHead(403); return res.end(); }
    let st = await stat(file).catch(() => null);
    if (!st || st.isDirectory()) file = join(ROOT, slug, "dist", "index.html"); // SPA 回退
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": rel && rel !== "index.html" ? "public, max-age=3600" : "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>该云实例不存在或尚未部署。</p>");
  }
}).listen(PORT, "0.0.0.0", () => console.log(`fusion-cloud static server on :${PORT}`));
SRVEOF

echo "== systemd 单元"
sudo tee /etc/systemd/system/fusion-cloud.service >/dev/null <<UNIT
[Unit]
Description=Fusion Cloud static hosting (simulated cloud on 214)
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/fusion-cloud
ExecStart=$(command -v node) /home/ubuntu/fusion-cloud/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload && sudo systemctl enable --now fusion-cloud
sleep 1 && sudo systemctl is-active fusion-cloud
curl -fsS http://127.0.0.1:8070/_health && echo
echo "== Fusion Cloud 基座就绪"
REMOTE

echo "== 完成:curl http://10.234.201.214:$PORT/_health"
