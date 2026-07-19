# ⚛ Quark — 智能体驱动的应用生成平台

> ROOT / AI Native 全栈工程师笔试作品。万物由原子构成,原子由夸克构成 —— Quark 是 Atoms 的"基本粒子版":
> 用一句话描述想法,由 Planner / Engineer / Reviewer 三个智能体协作,生成一个可运行、可迭代、可发布的网页应用。

**在线体验:<https://quark.lexarcai.com>**(注册任意邮箱即可,无需验证)

## 核心流程

```
注册/登录 → 描述想法 → Planner 产出产品规格 → Engineer 流式生成代码
        → Reviewer 评审(必要时修复) → 沙箱实时预览 → 对话式迭代 → 一键发布公开链接
```

- **真实交互**:生成的应用在沙箱 iframe 中即刻可用;平台本身的注册、项目管理、生成、发布全部真实落库。
- **数据持久化**:SQLite(用户 / 会话 / 项目 / 消息 / 应用版本五张表),服务重启数据不丢。
- **延展能力**(两项):
  1. **一键发布** —— 每个应用获得公开 URL `/p/{slug}`,任何人无需登录可访问(对应 Atoms 的 one-click deploy);
  2. **版本历史与回滚** —— 每次生成都是一个不可变版本,可随时切换,迭代基于当前选中版本进行。

## 实现思路与关键取舍

| 决策 | 取舍理由 |
|---|---|
| 单文件 HTML 作为生成产物 | 6-8h 内"可运行、可发布"优先于"多文件工程"。单文件自包含(禁外链资源)使沙箱预览、版本存储、公开发布都退化为一个字符串的读写,复杂度骤降;代价是生成物规模有上限 |
| 三智能体流水线而非单次 prompt | 还原 Atoms 的多智能体工作感,且各阶段职责单一:Planner 控制范围蔓延,Reviewer 兜底可用性;SSE 把每个阶段与代码逐 token 推到前端,过程可见 |
| Next.js 单体全栈 + SQLite(`node:sqlite`) | 一个进程覆盖 UI/API/静态服务;Node 24 内置 SQLite,零 ORM、零原生依赖,部署面最小。规模上去后再谈拆分 |
| 自研轻量 Auth(scrypt + httpOnly cookie) | 演示规模下引入 NextAuth/Clerk 属于过度设计;`node:crypto` 的 scrypt + 会话表 40 行解决 |
| LLM 用 DeepSeek(OpenAI 兼容) | 代码生成质量/价格比合适;客户端只依赖 `fetch`,换任何 OpenAI 兼容模型只改两个环境变量 |
| 生成应用的数据存 localStorage | 生成物的持久化下放给浏览器,平台侧持久化(项目/版本/会话)已由 SQLite 保证;代价是换设备不同步,见"继续投入" |

## 当前完成程度

已完成:

- [x] 注册 / 登录 / 会话(scrypt 哈希,httpOnly cookie)
- [x] 项目 Dashboard(列表 / 新建 / 删除)
- [x] Planner → Engineer → Reviewer 流水线,SSE 流式输出(阶段时间线 + 代码实况)
- [x] 沙箱 iframe 实时预览,预览/代码双视图
- [x] 对话式迭代(基于当前版本增量修改)
- [x] 版本历史、任意版本回滚
- [x] 一键发布 / 更新发布,公开访问页 `/p/{slug}`
- [x] 生产部署(systemd + Caddy 自动 HTTPS),线上全链路验证通过

已知局限(有意为之的范围控制):

- 生成产物限单文件 HTML,不支持多文件项目与外部依赖
- Reviewer 是单轮静态评审,没有真实运行时校验(如 headless 浏览器冒烟)
- 生成中断(刷新页面)后任务不续传,但已入库消息与版本不丢
- 未做邮箱验证、找回密码、速率限制等生产级账号能力

## 如果继续投入,如何扩展(按优先级)

1. **生成可靠性**:Reviewer 升级为 headless 浏览器实测(加载 + 控制台报错 + 关键交互脚本),失败自动回炉 —— 这是"可用率"的最大杠杆;
2. **任务队列与断线续传**:生成任务落库 + 后台 worker,前端断线重连拉取进度,支持并发生成;
3. **应用云存储**:给每个发布应用注入极小的 KV API(`quark.storage.get/set`),把生成应用的数据从 localStorage 升级为服务端持久化(对标 Atoms Cloud);
4. **多文件产物与依赖白名单**:引入 esbuild 服务端打包,支持 React/组件级生成;
5. **Race Mode**:同一 prompt 并发多模型生成,并排预览择优(对标 Atoms Race Mode)。

## 技术栈与架构

- Next.js 16(App Router)+ React 19 + TypeScript + Tailwind v4
- Node 24 内置 `node:sqlite`(WAL),无 ORM;`node:crypto` scrypt 做口令哈希
- DeepSeek API(OpenAI 兼容),服务端 `fetch` 直连,SSE 转发
- 部署:systemd 托管 `next start`,Caddy 反代 + Let's Encrypt 自动证书

```
src/
  lib/          db.ts(schema)· auth.ts(会话)· agent.ts(三段流水线)· projects.ts
  app/
    api/        auth/* · projects/*(CRUD · generate SSE · publish · rollback)
    p/[slug]/   已发布应用的公开页(原样输出 HTML)
    project/[id]  构建工作台(对话 + 智能体时间线 + 预览/代码)
    dashboard/  项目列表    login/ register/  landing
```

## 本地运行

```bash
npm install
echo 'DEEPSEEK_API_KEY=sk-...' > .env   # 任何 OpenAI 兼容模型:另设 DEEPSEEK_API_URL / DEEPSEEK_MODEL
npm run dev
```

打开 http://localhost:3000,注册后即可生成。数据落在 `./data/quark.db`。

---

*本项目按笔试要求以 vibe coding 方式完成:Claude Code(Fable 5)全程驱动 —— 规划、编码、冒烟测试、部署、文档,人工只做方向决策。*
