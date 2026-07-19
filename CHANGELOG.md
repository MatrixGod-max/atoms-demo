# Changelog

## v3 — 体验与产品闭环(2026-07-19)

- 移动端可用:Builder 双栏在小屏切换为「对话 / 应用」双 tab
- SSE 断流自动重连(最多 5 次,基于 job 活跃性判断),生成失败一键重试
- 展厅 `/explore`:已发布应用公开陈列(可关闭);landing 精选位
- **Remix**:任何已发布应用可一键 fork 到自己的工作台继续创造;发布应用注入可关闭的
  「⚛ 用 Quark 构建 · Remix」徽章,形成 生成→发布→被发现→被再创造 的闭环
- 演示账号 `demo@quark.dev / quark123`(只读),评审免注册可看带历史的工作台
- 取消发布、项目重命名、版本评审摘要提示、401 统一跳转、品牌 favicon、表单 autocomplete

## v2 — 生产化(2026-07-19)

- 生成作业化:任务落库 + 进程内队列(并发 2),SSE 缓冲重放断线续传,重启中断落明确失败态
- Validator 阶段:headless Chrome 真实运行产物,捕获运行时错误,自动回炉一轮修复
- 安全:发布应用独立源 `quark-apps.lexarcai.com`;预览沙箱收紧;登录/生成限流 + 24h 配额;Origin 校验
- 应用云存储:`window.quark.storage` 服务端 KV(8KB/值、64 键/应用),访客共享
- 可运维:`/api/health`、每日备份、vitest 11 例、mock 流水线、e2e 冒烟、GitHub Actions CI

## v1 — 笔试 MVP(2026-07-18)

- 注册/登录、项目 Dashboard、Planner→Engineer→Reviewer 流水线(SSE 流式)
- 沙箱实时预览、对话式迭代、版本回滚、一键发布 `/p/{slug}`
- 生产部署(systemd + Caddy 自动 HTTPS)
