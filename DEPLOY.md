# 部署运维手册(quark.lexarcai.com)

生产实例:AWS EC2(us-west-1,52.8.191.27,本机)。

## 拓扑

```
Internet :443
  → edge-nginx (docker, host net, SNI 分流: quark.lexarcai.com → 127.0.0.1:4443)
  → edge-caddy (docker, TLS 终结 + 反代, Let's Encrypt 自动续期)
  → quark.service (systemd, next start --port 8090)
  → SQLite: /home/ubuntu/projects/atoms-demo/data/quark.db (WAL)
```

- DNS:Route53 zone `lexarcai.com`(Z06701912Y6GOG19VIYI4),A 记录 `quark` → 52.8.191.27
- 边缘配置:`~/edge-proxy/nginx.conf`(SNI map)与 `~/edge-proxy/Caddyfile`(vhost)
  - **注意**:两者都是单文件 bind mount,编辑后必须 `docker restart edge-caddy edge-nginx`
    (容器内 reload 读到的是旧 inode)
- 秘钥:`/home/ubuntu/projects/atoms-demo/.env`(`DEEPSEEK_API_KEY`,0600,不入 git)

## 常用操作

```bash
# 状态 / 日志
systemctl status quark
journalctl -u quark -f

# 发版
cd ~/projects/atoms-demo && git pull && npm install && npm run build \
  && sudo systemctl restart quark

# 健康检查
curl -fsS -o /dev/null -w '%{http_code}\n' https://quark.lexarcai.com/

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

## 资源约束

本机 2 vCPU / 4 GiB,`quark.service` 设了 `MemoryMax=768M`。构建时先停开发进程;
若 OOM,`NODE_OPTIONS=--max-old-space-size=1536 npm run build`(已有 10G swap 兜底)。
