# 部署运维手册(quark.lexarcai.com)

生产实例:AWS EC2(us-west-1,52.8.191.27,本机)。

## 拓扑

```
Internet :443
  → edge-nginx (docker, host net, SNI 分流: quark.lexarcai.com / quark-apps.lexarcai.com → 127.0.0.1:4443)
  → edge-caddy (docker, TLS 终结 + 反代, Let's Encrypt 自动续期)
  → quark.service (systemd, next start --port 8090, MemoryMax=1536M — validator 的 Chrome 开销)
  → SQLite: /home/ubuntu/projects/atoms-demo/data/quark.db (WAL)
```

- 双域名同进程,`src/proxy.ts` 按 Host 分流:
  - `quark.lexarcai.com` — 平台(登录/工作台);`/p/*` 301 到 apps 域
  - `quark-apps.lexarcai.com` — 已发布应用 + 其 KV API(与平台 cookie/origin 隔离)
- DNS:Route53 zone `lexarcai.com`(Z06701912Y6GOG19VIYI4),A 记录 `quark`、`quark-apps` → 52.8.191.27
- 边缘配置:`~/edge-proxy/nginx.conf`(SNI map)与 `~/edge-proxy/Caddyfile`(vhost)
  - **注意**:两者都是单文件 bind mount,编辑后必须 `docker restart edge-caddy edge-nginx`
    (容器内 reload 读到的是旧 inode)
- 环境:`.env`(`DEEPSEEK_API_KEY`,0600,不入 git);`.env.production`
  (`NEXT_PUBLIC_APPS_ORIGIN` / `APPS_HOST` / `APPS_REDIRECT=1`,不入 git)
- 备份:ubuntu crontab 03:30 `sqlite3 .backup` → `~/backups/quark/`,保留 14 份

## 常用操作

```bash
# 状态 / 日志
systemctl status quark
journalctl -u quark -f

# 发版
cd ~/projects/atoms-demo && git pull && npm install && npm run build \
  && sudo systemctl restart quark

# 健康检查
curl -fsS https://quark.lexarcai.com/api/health

# 测试(单测 + mock 全链路冒烟)
npm test
AGENT_MOCK=1 npm run dev -- --port 3456 &   # 然后:
BASE_URL=http://localhost:3456 bash scripts/smoke.sh

# 备份数据库(WAL 安全快照)
sqlite3 ~/projects/atoms-demo/data/quark.db ".backup '/home/ubuntu/backups/quark-$(date +%F).db'"
```

## 回滚

```bash
cd ~/projects/atoms-demo && git log --oneline   # 找到目标 commit
git checkout <commit> && npm run build && sudo systemctl restart quark
# 恢复: git checkout main
```

## 停止 / 下线

```bash
sudo systemctl disable --now quark
# 边缘: 从 ~/edge-proxy/{nginx.conf,Caddyfile} 移除 quark 段后
docker restart edge-caddy edge-nginx
# DNS: 删除 Route53 A 记录 quark.lexarcai.com
```

## 自部署(Quark 服务本身)

默认形态 = 本机 systemd(上文)。容器路径(任意云主机同样适用,接口=环境变量):

```bash
cp .env.example .env 2>/dev/null || echo 'DEEPSEEK_API_KEY=sk-...' > .env
docker compose up -d          # :8090,数据在 named volume quark-data
```

S3 部署/模板资源功能需要 AWS 凭证链(compose 环境变量或挂载 ~/.aws)。
生产 systemd 单元含 `Environment=HOME=/home/ubuntu` 供 SDK 读取本机凭证。
模板种子:`node scripts/seed-templates.mjs`(加 `--no-s3` 跳过上传)。

## 资源约束

本机 2 vCPU / 4 GiB,`quark.service` 设了 `MemoryMax=768M`。构建时先停开发进程;
若 OOM,`NODE_OPTIONS=--max-old-space-size=1536 npm run build`(已有 10G swap 兜底)。

## Android 构建机(v18,ubuntu@10.234.201.214)

- 一次性装机/修复:`NATIVE_BUILD_HOST=ubuntu@10.234.201.214 bash scripts/setup-android-builder.sh`
  (幂等;本机 ssh 驱动;产物在远端 `~/fusion-android/`:jdk/sdk/template/build.sh,日志 setup.log)
- 平台 env:`NATIVE_BUILD_HOST`(默认 ubuntu@10.234.201.214);测试/CI 用 `NATIVE_BUILD_MOCK=1`
- 运维:失败构建的远端现场保留在 `~/fusion-android/ws/<buildId>`(排查后手动删);
  APK 产物在平台 `DATA_DIR/native-builds/`;磁盘检查 `ssh ... 'du -sh ~/fusion-android'`
- iOS:`scripts/setup-ios-builder.sh` 对 `NATIVE_BUILD_IOS_HOST` 做环境检查(需 macOS≥13 + Xcode≥15),
  通过后配置该 env 即启用;当前指定 Mac(10.234.201.128)为 macOS 10.13,检查会明确拒绝

## 语音转写服务(v20,ubuntu@10.234.201.214:8022)

- 装机/修复:`bash scripts/setup-speech-server.sh`(幂等;写 214 的 venv/server.py/systemd,
  并把 `SPEECH_SERVICE_URL/TOKEN` 写入本地 .env 与 .env.production;token 不回显)
- 运维:`ssh ... 'sudo systemctl status|restart fusion-speech'`;日志 `sudo journalctl -u fusion-speech -n 50`;
  换模型改 `/etc/fusion-speech.env` 的 `WHISPER_MODEL`(如 large-v3-turbo,需评估 CPU 时延或迁 GPU)后重启
- 平台侧:未配置 `SPEECH_SERVICE_URL` 时接口返回 503「语音服务未启用」;测试/CI 用 `SPEECH_MOCK=1`

## 边缘代理与麦克风权限(2026-07-19)

- 语音输入曾被 `~/edge-proxy/Caddyfile` 的全局安全头 `Permissions-Policy: microphone=()`
  站点级禁用(不弹授权直接 NotAllowedError)。已在 quark.lexarcai.com 站点块**内联**安全头
  并放开 `microphone=(self)`(不再 import sec_common:其块含 `-Server` 删除操作导致整块
  defer,后写的覆盖会被回盖);其他域与 quark-apps 应用域保持全禁
- 运维坑:edge-caddy 以**单文件 bind mount** 挂 Caddyfile —— 编辑必须原地写入(保 inode,
  如 python open('w') / cp),用 rename 语义的编辑器(sed -i 等)会让容器停留在旧 inode,
  需 `docker restart edge-caddy` 重挂;改完 `docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile`
- 注意:~/edge-proxy 非 git 仓库,本变更以此文档为准
