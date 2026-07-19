/**
 * Quark agent pipeline: Planner -> Engineer -> Reviewer.
 * Each run yields typed events that the API route forwards as SSE.
 */

const API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

/**
 * Split an internal model token (`<model>` / `<model>:thinking`, see models.ts)
 * into DeepSeek v4 request params. `thinking` defaults to enabled server-side,
 * so it must be sent explicitly on every call. Legacy names are mapped for
 * stray env overrides (deepseek-chat/-reasoner retire on 2026-07-24).
 */
function resolveModel(token: string): { model: string; thinking: { type: "enabled" | "disabled" } } {
  if (token === "deepseek-chat") return { model: "deepseek-v4-flash", thinking: { type: "disabled" } };
  if (token === "deepseek-reasoner") return { model: "deepseek-v4-flash", thinking: { type: "enabled" } };
  const thinking = token.endsWith(":thinking");
  return { model: thinking ? token.slice(0, -":thinking".length) : token, thinking: { type: thinking ? "enabled" : "disabled" } };
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

import {
  runAcceptance,
  validateHtml,
  type AcceptanceCase,
  type AcceptanceOutcome,
  type AcceptanceStep,
} from "./validate";
import { fetchReferences } from "./research";
import { modelBadge, normalizeMode, stageModels, type GenerationMode } from "./models";
import type { PipelineAttachment } from "./attachments";
import { CONNECTORS } from "./connectors";
import { buildProject, formatBuildErrors } from "./build";
import {
  concatSources,
  mergeFiles,
  parseFileStream,
  validateFiles,
  type ProjectFiles,
} from "./projectFiles";

export interface ResearchBrief {
  audience: string;
  patterns: string[];
  must_have: string[];
  nice_to_have: string[];
  risks: string[];
  references: string[];
}

export interface PmStories {
  name: string;
  summary: string;
  goal: string;
  stories: string[];
  acceptance: string[];
}

export interface FusionPlan {
  name: string;
  summary: string;
  from_a: string[];
  from_b: string[];
  fusion: string[];
}

export type AgentEvent =
  | {
      type: "stage";
      stage: "researcher" | "fusion" | "pm" | "architect" | "planner" | "engineer" | "build" | "reviewer" | "validator";
      status: "start" | "done";
      info?: string;
      model?: string;
    }
  | { type: "plan"; spec: AppSpec }
  | { type: "files"; files: ProjectFiles }
  | { type: "fusion"; plan: FusionPlan }
  | { type: "pm"; stories: PmStories }
  | { type: "architect"; blueprint: string }
  | { type: "research"; brief: ResearchBrief }
  | { type: "acceptance"; results: AcceptanceOutcome[] }
  | { type: "code_delta"; delta: string }
  | { type: "code_reset" }
  | { type: "agent_message"; content: string }
  | { type: "html"; html: string; reviewNotes: string }
  | { type: "error"; message: string };

export interface AppSpec {
  name: string;
  summary: string;
  features: string[];
  design: string;
}

function apiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
  return key;
}

async function chat(messages: ChatMessage[], maxTokens = 4096, temperature = 0.3, model = MODEL): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({ ...resolveModel(model), messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}

async function* chatStream(
  messages: ChatMessage[],
  maxTokens = 8192,
  temperature = 0.2,
  model = MODEL
): AsyncGenerator<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({ ...resolveModel(model), messages, max_tokens: maxTokens, temperature, stream: true }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore malformed keep-alive chunks
      }
    }
  }
}

export function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n/, "");
    if (t.endsWith("```")) t = t.slice(0, -3);
  }
  return t.trim();
}

export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("planner returned no JSON");
  return text.slice(start, end + 1);
}

const ENGINEER_RULES_MOBILE_EXTRA = `
移动应用附加规则(本项目是移动应用,同样必须严格遵守):
A. 以 390px 宽竖屏为第一目标设计,布局纵向流动;<meta name="viewport"> 必须含 viewport-fit=cover。
B. 全部可点击目标尺寸 ≥44×44px;交互不得依赖 hover;主操作放在页面底部拇指可达区。
C. 用 env(safe-area-inset-top/bottom) 处理刘海与 Home 指示条的安全区留白。
D. 加入 <meta name="theme-color"> 与 <meta name="apple-mobile-web-app-capable" content="yes">、<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">。
E. 动画只用 transform/opacity(不触发重排);列表滚动容器用 -webkit-overflow-scrolling:touch。`;

const ENGINEER_RULES = `输出规则(必须严格遵守):
1. 只输出一个完整的、自包含的 HTML 文件,从 <!DOCTYPE html> 开始。不要输出任何 markdown 代码围栏或解释文字。
2. 所有 CSS 和 JavaScript 必须内联在该文件中,禁止引用任何外部资源(CDN、字体、图片 URL 等),图标可用 emoji 或内联 SVG。
3. 应用必须具备真实交互(增删改查、状态变化等),不能是静态展示页。
4. 数据持久化:优先使用平台注入的 \`window.quark.storage\`(async get(key)/set(key,value),字符串值,发布后所有访客共享)——用法:\`if(window.quark&&window.quark.storage){...}\`;不可用时回退 localStorage。两种访问都必须包在 try/catch 中,存取失败时应用仍要能正常使用(内存态)。
5. 视觉设计要现代、精致:合理的间距与层级、和谐配色、hover/过渡效果、移动端可用(响应式)。
6. 代码健壮:处理空状态(无数据时的引导提示)、非法输入,不允许出现未捕获异常。
7. 界面语言与用户需求的语言一致。`;

const ENGINEER_RULES_PROJECT = `输出规则(必须严格遵守):
1. 以多文件工程形式输出。每个文件之前单独一行标记:===== FILE: 路径 =====,随后紧跟该文件的完整内容。不要输出 markdown 代码围栏,不要输出任何解释文字。
2. 工程结构约定:入口 index.html(用 <script src="src/main.jsx"></script> 与 <link rel="stylesheet" href="styles.css"> 引用本地文件);React 代码放 src/ 下(.jsx/.tsx);文件总数 ≤6。
3. 允许 import 的外部依赖仅限:react、react-dom/client(JSX 由构建器自动接 react/jsx-runtime)。其余依赖一律禁止;禁止任何外链资源(CDN/字体/图片 URL),图标用 emoji 或内联 SVG。
4. index.html 只放结构与挂载点(如 <div id="root"></div>),不写内联业务 <script>/<style>——逻辑进 src/*.jsx,样式进 styles.css。
5. 数据持久化:优先平台注入的 window.quark.storage(async get(key)/set(key,value),字符串值,发布后所有访客共享),不可用时回退 localStorage;两种访问都包 try/catch,失败时应用仍要能工作(内存态)。
6. 应用必须具备真实交互;视觉现代精致、响应式;健壮处理空状态与非法输入,不允许未捕获异常。
7. 界面语言与用户需求的语言一致。`;

const ENGINEER_RULES_PROJECT_ITERATE = `
本次是对既有工程的修改:只输出发生变化或新增的文件(每个文件依然输出完整内容),需要删除的文件输出一行 ===== DELETE: 路径 =====;未变化的文件一律不要输出。`;

export interface PipelineInput {
  request: string;
  history: { role: "user" | "agent"; content: string }[];
  currentHtml: string | null;
  specJson: string | null;
  platform: "web" | "mobile";
  research?: boolean;
  team?: boolean;
  theme?: string | null;
  connectors?: string[];
  attachments?: PipelineAttachment[];
  mode?: GenerationMode;
  goal?: string | null;
  /** Element picked in the preview (指哪改哪): scope this iteration to it. */
  target?: { selector: string; snippet: string } | null;
  /** Persisted PM acceptance criteria — drives acceptance tests on iterations. */
  acceptance?: string[] | null;
  /** 聚变: the two published source apps to merge (first generation only). */
  fusionSources?: { name: string; html: string; spec: string | null }[] | null;
  /** 工程模式: multi-file source tree + esbuild pipeline instead of one HTML. */
  engine?: "single" | "project";
  /** Current version's source tree (project engine iterations). */
  files?: ProjectFiles | null;
}

const ACCEPTANCE_ACTIONS = ["click", "type", "assertText", "assertExists", "assertNotExists"];

/** Compile PM acceptance criteria into declarative DSL test cases (data, not code). */
async function buildAcceptanceCases(html: string, criteria: string[], model: string): Promise<AcceptanceCase[]> {
  const raw = await chat(
    [
      {
        role: "system",
        content: `你是 Fusion 平台的验收测试智能体(QA)。给定一个单文件应用的 HTML 与它的验收标准,为每条标准编写一个可自动执行的交互测试用例。只允许以下动作:
- {"action":"click","selector":"CSS选择器"} 点击元素
- {"action":"type","selector":"...","text":"输入内容"} 在输入框中输入
- {"action":"assertText","selector":"...","contains":"期望包含的文本"} 断言元素文本
- {"action":"assertExists","selector":"..."} 断言元素存在
- {"action":"assertNotExists","selector":"..."} 断言元素不存在
selector 必须是该 HTML 中真实存在的选择器(优先用 id)。每条标准最多 8 步;无法用这些动作验证的标准(如纯视觉/性能类)输出空 steps。
严格输出 JSON(无其他文字):{"cases":[{"criterion":"标准原文","steps":[...]}]},cases 与标准一一对应、顺序一致。`,
      },
      {
        role: "user",
        content: `验收标准:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\n应用完整代码:\n${html.slice(0, 40_000)}`,
      },
    ],
    3072,
    0.2,
    model
  );
  const parsed = JSON.parse(extractJson(raw)) as { cases?: unknown };
  const arr = Array.isArray(parsed.cases) ? parsed.cases : [];
  const out: AcceptanceCase[] = [];
  for (let i = 0; i < Math.min(arr.length, criteria.length); i++) {
    const c = arr[i] as { criterion?: unknown; steps?: unknown };
    const steps: AcceptanceStep[] = [];
    if (Array.isArray(c.steps)) {
      for (const s of c.steps.slice(0, 8)) {
        const st = s as { action?: unknown; selector?: unknown; text?: unknown; contains?: unknown };
        if (typeof st.action !== "string" || !ACCEPTANCE_ACTIONS.includes(st.action)) continue;
        if (typeof st.selector !== "string" || !st.selector.trim() || st.selector.length > 200) continue;
        steps.push({
          action: st.action as AcceptanceStep["action"],
          selector: st.selector.trim(),
          text: typeof st.text === "string" ? st.text.slice(0, 200) : undefined,
          contains: typeof st.contains === "string" ? st.contains.slice(0, 200) : undefined,
        });
      }
    }
    out.push({
      criterion: typeof c.criterion === "string" && c.criterion.trim() ? c.criterion.slice(0, 200) : criteria[i],
      steps,
    });
  }
  // Criteria the model dropped still show up — as untestable.
  for (let i = out.length; i < criteria.length; i++) out.push({ criterion: criteria[i], steps: [] });
  return out;
}

/**
 * 工程模式的一轮修复:把问题描述交给 Engineer,只收变更文件,合并后重建。
 * 产出无效/仍构建失败时返回 null(调用方保留原产物)。
 */
async function* projectFixRound(
  files: ProjectFiles,
  problem: string,
  systemPrompt: string,
  model: string
): AsyncGenerator<AgentEvent, { files: ProjectFiles; html: string } | null> {
  let raw = "";
  yield { type: "code_reset" };
  for await (const delta of chatStream(
    [
      { role: "system", content: `${systemPrompt}${ENGINEER_RULES_PROJECT_ITERATE}` },
      {
        role: "user",
        content: `${problem}\n\n当前工程源码:\n${concatSources(files)}\n\n请修复上述问题:只输出需要修改/新增的文件(===== FILE: 路径 ===== + 完整内容),必要时用 ===== DELETE: 路径 =====。保持功能与视觉不变。`,
      },
    ],
    8192,
    0.2,
    model
  )) {
    raw += delta;
    yield { type: "code_delta", delta };
  }
  const parsed = parseFileStream(raw);
  if (!Object.keys(parsed.files).length && !parsed.deletes.length) return null;
  const merged = mergeFiles(files, parsed);
  if (validateFiles(merged)) return null;
  const built = await buildProject(merged);
  if (!built.ok) return null;
  return { files: merged, html: built.html! };
}

/** Attachment context shared by Planner and Engineer prompts. */
function attachmentContext(attachments: PipelineAttachment[] | undefined): string {
  if (!attachments?.length) return "";
  const parts: string[] = [];
  const texts = attachments.filter((a) => a.kind === "text" && a.text);
  const images = attachments.filter((a) => a.kind === "image");
  for (const t of texts) {
    parts.push(`【用户附件「${t.filename}」内容】\n${t.text!.slice(0, 16_000)}`);
  }
  if (images.length) {
    parts.push(
      `【可用图片资源】${images.map((i) => `asset://${i.filename}`).join(", ")}\n引用图片时必须写 src="asset://文件名"(平台会自动内联为 data URI);禁止引用不存在的资源名或外部图片。`
    );
  }
  return `\n\n${parts.join("\n\n")}`;
}

const MOCK_PROJECT_FILES: ProjectFiles = {
  "index.html": `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mock 工程计数器</title><link rel="stylesheet" href="styles.css"></head>
<body><div id="root"></div><script src="src/main.jsx"></script></body></html>
`,
  "src/main.jsx": `import { createRoot } from "react-dom/client";
import { useState } from "react";
function App() {
  const [n, setN] = useState(0);
  return (
    <main>
      <h1 id="n">{n}</h1>
      <button id="b" onClick={() => setN(n + 1)}>+1</button>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
`,
  "styles.css": `body{font-family:sans-serif;display:flex;justify-content:center;padding-top:40px}
button{font-size:20px;padding:8px 24px}
`,
};

/** 工程模式 mock:流式输出 FILE 协议 → 真实 esbuild 构建 → 校验/验收,覆盖完整开发循环。 */
async function* runMockProjectPipeline(input: PipelineInput): AsyncGenerator<AgentEvent> {
  const isIteration = !!input.currentHtml;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sm = stageModels(normalizeMode(input.mode));
  const buildBroken = input.request.includes("MOCK_BUILD_BROKEN");

  if (!isIteration) {
    yield { type: "stage", stage: "planner", status: "start", model: modelBadge(sm.planner) };
    await sleep(30);
    const spec: AppSpec = { name: "Mock 工程计数器", summary: "多文件 React mock", features: ["点击 +1"], design: "极简" };
    yield { type: "plan", spec };
    yield { type: "stage", stage: "planner", status: "done", info: spec.name };
  }

  yield { type: "stage", stage: "engineer", status: "start", model: modelBadge(sm.engineer) };
  let files: ProjectFiles;
  if (isIteration && input.files) {
    // Iteration: emit only one changed file, exercising the merge path.
    const changed = `${input.files["styles.css"] ?? ""}/* mock-iterated */\n`;
    const stream = `===== FILE: styles.css =====\n${changed}`;
    for (let i = 0; i < stream.length; i += 120) {
      await sleep(10);
      yield { type: "code_delta", delta: stream.slice(i, i + 120) };
    }
    files = mergeFiles(input.files, parseFileStream(stream));
  } else {
    const tree: ProjectFiles = { ...MOCK_PROJECT_FILES };
    if (buildBroken) tree["src/main.jsx"] = `const broken = {;\n${tree["src/main.jsx"]}`;
    const stream = Object.entries(tree)
      .map(([p, c]) => `===== FILE: ${p} =====\n${c}`)
      .join("");
    for (let i = 0; i < stream.length; i += 200) {
      await sleep(10);
      yield { type: "code_delta", delta: stream.slice(i, i + 200) };
    }
    files = parseFileStream(stream).files;
  }
  const invalid = validateFiles(files);
  if (invalid) throw new Error(`mock 工程无效:${invalid}`);
  yield { type: "stage", stage: "engineer", status: "done", info: `${Object.keys(files).length} 个文件` };

  yield { type: "stage", stage: "build", status: "start" };
  let built = await buildProject(files);
  let repairRounds = 0;
  if (!built.ok && buildBroken) {
    // Deterministic "repair": drop the injected syntax error, like the real loop would.
    repairRounds = 1;
    yield { type: "stage", stage: "build", status: "start", info: `${built.errors!.length} 个构建错误,回炉修复(第 1 轮)` };
    files = { ...files, "src/main.jsx": files["src/main.jsx"].replace(/^const broken = \{;\n/, "") };
    built = await buildProject(files);
  }
  if (!built.ok) throw new Error(`mock 构建失败:${formatBuildErrors(built.errors!)}`);
  const html = built.html!;
  yield {
    type: "stage",
    stage: "build",
    status: "done",
    info: `打包 ${built.meta.files} 个文件 → ${Math.round(built.meta.bundleBytes / 1024)}KB${repairRounds ? `,含 ${repairRounds} 轮修复` : ""}`,
  };

  yield { type: "stage", stage: "reviewer", status: "start", model: modelBadge(sm.reviewer) };
  await sleep(30);
  yield { type: "stage", stage: "reviewer", status: "done", info: "mock 评审通过" };

  yield { type: "stage", stage: "validator", status: "start" };
  let validatorNotes = "运行通过,无报错";
  const v1 = await validateHtml(html, input.platform);
  if (v1.skipped) validatorNotes = "校验环境不可用,跳过";
  else if (!v1.ok) validatorNotes = `存在 ${v1.errors.length} 个运行时错误`;
  const mockCriteria = input.acceptance?.length ? input.acceptance : input.team ? ["点击后数字+1"] : [];
  if (mockCriteria.length) {
    const ar = await runAcceptance(html, input.platform, [
      {
        criterion: mockCriteria[0],
        steps: [
          { action: "click", selector: "#b" },
          { action: "assertText", selector: "#n", contains: "1" },
        ],
      },
    ]);
    if (ar.skipped) validatorNotes += ";验收环境不可用,跳过";
    else {
      yield { type: "acceptance", results: ar.results };
      validatorNotes += `;验收 ${ar.results.filter((r) => r.pass).length}/${ar.results.length} 通过`;
    }
  }
  yield { type: "stage", stage: "validator", status: "done", info: validatorNotes };
  yield { type: "files", files };
  yield { type: "html", html, reviewNotes: `mock 评审通过;${validatorNotes}` };
  yield { type: "agent_message", content: isIteration ? "mock 工程迭代完成" : "「Mock 工程计数器」已生成" };
}

/** Deterministic, LLM-free pipeline for tests/CI (AGENT_MOCK=1). */
async function* runMockPipeline(input: PipelineInput): AsyncGenerator<AgentEvent> {
  const isIteration = !!input.currentHtml;
  const broken = input.request.includes("MOCK_BROKEN");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sm = stageModels(normalizeMode(input.mode));
  if (input.research) {
    yield { type: "stage", stage: "researcher", status: "start", model: modelBadge(sm.researcher) };
    await sleep(60);
    yield {
      type: "research",
      brief: {
        audience: "mock 用户",
        patterns: ["mock 模式"],
        must_have: ["计数"],
        nice_to_have: ["持久化"],
        risks: ["无"],
        references: [],
      },
    };
    yield { type: "stage", stage: "researcher", status: "done", info: "mock 研究完成" };
  }
  const mockFusing = !isIteration && input.fusionSources?.length === 2;
  if (mockFusing) {
    const [a, b] = input.fusionSources!;
    yield { type: "stage", stage: "fusion", status: "start", model: modelBadge(sm.planner) };
    await sleep(40);
    yield {
      type: "fusion",
      plan: {
        name: "Mock 聚变应用",
        summary: `mock 合并 ${a.name} 与 ${b.name}`,
        from_a: [`${a.name} 的计数`],
        from_b: [`${b.name} 的展示`],
        fusion: ["统一状态"],
      },
    };
    yield { type: "stage", stage: "fusion", status: "done", info: "Mock 聚变应用" };
  }
  if (input.team && !mockFusing) {
    if (!isIteration) {
      yield { type: "stage", stage: "pm", status: "start", model: modelBadge(sm.pm) };
      await sleep(40);
      yield {
        type: "pm",
        stories: { name: "Mock 计数器", summary: "mock 团队产物", goal: "计数", stories: ["作为用户我想点击计数"], acceptance: ["点击后数字+1"] },
      };
      yield { type: "stage", stage: "pm", status: "done", info: "1 个用户故事", model: modelBadge(sm.pm) };
    }
    yield { type: "stage", stage: "architect", status: "start", model: modelBadge(sm.architect) };
    await sleep(40);
    yield { type: "architect", blueprint: isIteration ? "变更蓝图:仅调整按钮区块" : "架构蓝图:标题区 + 计数区 + 按钮区" };
    yield { type: "stage", stage: "architect", status: "done", info: "蓝图就绪", model: modelBadge(sm.architect) };
  }
  if (!isIteration && !input.team && !mockFusing) {
    yield { type: "stage", stage: "planner", status: "start", model: modelBadge(sm.planner) };
    await sleep(50);
    const spec: AppSpec = {
      name: "Mock 计数器",
      summary: "用于测试的最小计数应用",
      features: ["点击 +1", "数据持久化"],
      design: "极简",
    };
    yield { type: "plan", spec };
    yield { type: "stage", stage: "planner", status: "done", info: spec.name };
  }
  yield { type: "stage", stage: "engineer", status: "start", model: modelBadge(sm.engineer) };
  const mobileMeta =
    input.platform === "mobile"
      ? `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#0d0e1c"><meta name="apple-mobile-web-app-capable" content="yes">`
      : `<meta name="viewport" content="width=device-width, initial-scale=1">`;
  const themeComment = input.theme ? `<!-- theme: ${input.theme} -->` : "";
  const connComment = input.connectors?.length ? `<!-- connectors: ${input.connectors.join(",")} -->` : "";
  const attComment = input.attachments?.length
    ? `<!-- attachments: ${input.attachments.map((a) => a.filename).join(", ")} -->`
    : "";
  const targetComment = input.target ? `<!-- target: ${input.target.selector} -->` : "";
  const fusionComment = mockFusing
    ? `<!-- fused: ${input.fusionSources!.map((s) => s.name).join("+")} -->`
    : "";
  let html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">${mobileMeta}${attComment}${themeComment}${connComment}${targetComment}${fusionComment}<title>Mock 计数器</title>
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px}button{font-size:20px;padding:8px 24px}</style>
</head><body><h1 id="n">0</h1><button id="b">+1</button>
${broken ? "<script>throw new Error('mock runtime failure')<\/script>" : ""}
<script>
(async function(){
  var n=0;
  async function load(){try{if(window.quark&&window.quark.storage){var v=await window.quark.storage.get('count');if(v!=null)n=parseInt(v,10)||0;}else{n=parseInt(localStorage.getItem('mock_count')||'0',10)||0;}}catch(e){}}
  async function save(){try{if(window.quark&&window.quark.storage){await window.quark.storage.set('count',String(n));}else{localStorage.setItem('mock_count',String(n));}}catch(e){}}
  await load();
  document.getElementById('n').textContent=n;
  document.getElementById('b').onclick=async function(){n++;document.getElementById('n').textContent=n;await save();};
})();
<\/script></body></html>`;
  for (let i = 0; i < html.length; i += 200) {
    await sleep(20);
    yield { type: "code_delta", delta: html.slice(i, i + 200) };
  }
  yield { type: "stage", stage: "engineer", status: "done", info: `${html.length} 字符` };
  yield { type: "stage", stage: "reviewer", status: "start", model: modelBadge(sm.reviewer) };
  await sleep(50);
  yield { type: "stage", stage: "reviewer", status: "done", info: "mock 评审通过" };

  yield { type: "stage", stage: "validator", status: "start" };
  let validatorNotes = "运行通过,无报错";
  const v1 = await validateHtml(html, input.platform);
  if (v1.skipped) {
    validatorNotes = "校验环境不可用,跳过";
  } else if (!v1.ok) {
    html = html.replace(/<script>throw[^<]*<\/script>/, "");
    yield { type: "code_reset" };
    yield { type: "code_delta", delta: html };
    const v2 = await validateHtml(html, input.platform);
    validatorNotes = `捕获 ${v1.errors.length} 个运行时错误并修复(复验${v2.ok ? "通过" : "未过"})`;
  }
  // Acceptance path exercises the real DSL executor against the mock app.
  const mockCriteria = input.acceptance?.length ? input.acceptance : input.team ? ["点击后数字+1"] : [];
  if (mockCriteria.length) {
    const ar = await runAcceptance(html, input.platform, [
      {
        criterion: mockCriteria[0],
        steps: [
          { action: "click", selector: "#b" },
          { action: "assertText", selector: "#n", contains: "1" },
        ],
      },
    ]);
    if (ar.skipped) {
      validatorNotes += ";验收环境不可用,跳过";
    } else {
      yield { type: "acceptance", results: ar.results };
      validatorNotes += `;验收 ${ar.results.filter((r) => r.pass).length}/${ar.results.length} 通过`;
    }
  }
  yield { type: "stage", stage: "validator", status: "done", info: validatorNotes };
  yield { type: "html", html, reviewNotes: `mock 评审通过;${validatorNotes}` };
  yield { type: "agent_message", content: isIteration ? "mock 迭代完成" : "「Mock 计数器」已生成" };
}

export async function* runPipeline(input: PipelineInput): AsyncGenerator<AgentEvent> {
  if (process.env.AGENT_MOCK === "1") {
    if (input.engine === "project") yield* runMockProjectPipeline(input);
    else yield* runMockPipeline(input);
    return;
  }
  const isIteration = !!input.currentHtml;
  const isProject = input.engine === "project";
  let files: ProjectFiles | null = isProject ? (input.files ?? null) : null;
  let spec: AppSpec | null = input.specJson ? (JSON.parse(input.specJson) as AppSpec) : null;

  // ---- Stage 1: Planner (first generation only) ----
  const isMobile = input.platform === "mobile";
  const attContext = attachmentContext(input.attachments);
  const goalContext = input.goal
    ? `\n\n【目标】本项目的最终目标:${input.goal}。所有产出都要向该目标收敛,优先补齐目标要求的能力。`
    : "";
  const sm = stageModels(normalizeMode(input.mode));

  // ---- Stage 0 (optional): Researcher ----
  let brief: ResearchBrief | null = null;
  if (input.research) {
    yield { type: "stage", stage: "researcher", status: "start", model: modelBadge(sm.researcher) };
    const references = await fetchReferences(input.request);
    const refBlock = references.length
      ? `\n\n参考资料(用户提供的链接抓取):\n${references.map((r) => `- ${r.url}\n${r.excerpt.slice(0, 1500)}`).join("\n")}`
      : "";
    try {
      const raw = await chat(
        [
          {
            role: "system",
            content: `你是 Quark 平台的研究员智能体(Deep Researcher)。对用户的应用想法做深入的领域分析:先自问自答(目标用户是谁/他们现在怎么解决/同类产品的成熟交互模式/什么功能是及格线/什么是差异化/最大的落地风险),再收敛为结构化简报。严格输出 JSON(无其他文字):
{"audience":"目标用户一句话","patterns":["同类产品值得借鉴的2-4个模式"],"must_have":["必备功能2-4条"],"nice_to_have":["加分功能1-3条"],"risks":["风险或易错点1-3条"],"references":["引用来源,无则空数组"]}
语言与用户输入一致。`,
          },
          { role: "user", content: `${input.request}${goalContext}${refBlock}${attContext}` },
        ],
        2048,
        0.6,
        sm.researcher
      );
      brief = JSON.parse(extractJson(raw)) as ResearchBrief;
      if (references.length) brief.references = references.map((r) => r.url);
      yield { type: "research", brief };
      yield { type: "stage", stage: "researcher", status: "done", info: `${brief.must_have.length + brief.nice_to_have.length} 个功能洞察` };
    } catch {
      yield { type: "stage", stage: "researcher", status: "done", info: "研究失败,跳过(不影响生成)" };
    }
  }

  // ---- 聚变: Fusion Analyst merges two published apps (first generation only) ----
  let fusionPlan: FusionPlan | null = null;
  const fusing = !isIteration && input.fusionSources?.length === 2;
  if (fusing) {
    const [a, b] = input.fusionSources!;
    yield { type: "stage", stage: "fusion", status: "start", model: modelBadge(sm.planner) };
    const raw = await chat(
      [
        {
          role: "system",
          content: `你是 Fusion 平台的聚变分析师(Fusion Analyst)。用户选择了两个已发布应用做「聚变」——合并为一个全新应用,而非简单拼接。分析两份代码的核心能力与数据模型,输出合并蓝图,严格输出 JSON(无其他文字):
{"name":"新应用名(<=12字)","summary":"一句话定位","from_a":["保留自应用A的核心能力 2-4 条"],"from_b":["保留自应用B的核心能力 2-4 条"],"fusion":["两者结合产生的新能力或统一设计 1-3 条"]}
语言与应用内容一致。取舍务实:只保留一次生成能落地的范围;两个应用的数据模型要设计成统一的状态结构。`,
        },
        {
          role: "user",
          content: `应用 A「${a.name}」代码(节选):\n${a.html.slice(0, 8000)}\n\n应用 B「${b.name}」代码(节选):\n${b.html.slice(0, 8000)}\n\n用户需求:${input.request}`,
        },
      ],
      2048,
      0.4,
      sm.planner
    );
    fusionPlan = JSON.parse(extractJson(raw)) as FusionPlan;
    yield { type: "fusion", plan: fusionPlan };
    yield { type: "stage", stage: "fusion", status: "done", info: fusionPlan.name };
    spec = {
      name: fusionPlan.name,
      summary: fusionPlan.summary,
      features: [...fusionPlan.from_a.slice(0, 2), ...fusionPlan.from_b.slice(0, 2), ...fusionPlan.fusion.slice(0, 1)],
      design: "",
    };
  }

  // ---- Team mode: PM -> Architect (replaces the single Planner on fresh builds) ----
  let pmOut: PmStories | null = null;
  let blueprint: string | null = null;
  if (input.team && !fusing) {
    if (!isIteration) {
      yield { type: "stage", stage: "pm", status: "start", model: modelBadge(sm.pm) };
      const rawPm = await chat(
        [
          {
            role: "system",
            content: `你是 Fusion 平台的产品经理智能体(PM)。把用户的${isMobile ? "移动" : "网页"}应用想法细化为可开发的需求,严格输出 JSON(无其他文字):
{"name":"应用名(<=12字)","summary":"一句话定位","goal":"用户目标一句话","stories":["作为…我想…以便…(3-5条,按优先级)"],"acceptance":["可验证的验收标准 3-5 条"]}
语言与用户输入一致。故事要克制:只写一次生成能落地的范围。`,
          },
          {
            role: "user",
            content: `${input.request}${goalContext}${brief ? `\n\n研究员简报:\n${JSON.stringify(brief, null, 2)}` : ""}${attContext}`,
          },
        ],
        2048,
        0.5,
        sm.pm
      );
      pmOut = JSON.parse(extractJson(rawPm)) as PmStories;
      yield { type: "pm", stories: pmOut };
      yield { type: "stage", stage: "pm", status: "done", info: `${pmOut.stories.length} 个用户故事` };
      spec = { name: pmOut.name, summary: pmOut.summary, features: pmOut.stories.slice(0, 5), design: "" };
    }
    yield { type: "stage", stage: "architect", status: "start", model: modelBadge(sm.architect) };
    const rawArch = await chat(
      [
        {
          role: "system",
          content: `你是 Fusion 平台的架构师智能体(Architect)。${
            isIteration
              ? "针对现有单文件应用的修改需求,输出一份精炼的「变更蓝图」:改动哪些区块/组件、状态与数据流如何调整、哪些保持不变。500 字以内,条目化。"
              : "为单文件应用输出一份精炼的「界面架构蓝图」:信息架构(页面区块自上而下)、核心组件清单、状态与数据流(含持久化 key)、关键交互。600 字以内,条目化。"
          }语言与用户输入一致,不要输出代码。`,
        },
        {
          role: "user",
          content: isIteration
            ? `现有应用代码(节选前 6000 字):\n${(input.currentHtml ?? "").slice(0, 6000)}\n\n修改需求: ${input.request}${goalContext}${attContext}`
            : `需求:${input.request}${goalContext}\n\nPM 需求单:\n${JSON.stringify(pmOut, null, 2)}${attContext}`,
        },
      ],
      2048,
      0.4,
      sm.architect
    );
    blueprint = rawArch.trim();
    yield { type: "architect", blueprint };
    yield { type: "stage", stage: "architect", status: "done", info: isIteration ? "变更蓝图就绪" : "架构蓝图就绪" };
    if (spec) spec.design = blueprint.split("\n")[0].slice(0, 60);
  }

  if (!isIteration && !input.team && !fusing) {
    yield { type: "stage", stage: "planner", status: "start", model: modelBadge(sm.planner) };
    const raw = await chat(
      [
        {
          role: "system",
          content: `你是 Quark 平台的产品规划智能体(Planner)。用户会描述一个${isMobile ? "移动" : "网页"}应用的想法,你需要输出一份精炼的产品规格,严格输出 JSON(无其他文字):
{"name": "应用名(<=12字)", "summary": "一句话定位", "features": ["3-5个核心功能点"], "design": "一句话视觉方向"}
语言与用户输入一致。规格要克制务实:只保留一次生成能落地的功能。${
            isMobile
              ? "\n这是移动应用:核心流程必须单手可完成、页面层级 ≤3,规格中体现触控优先与离线可用性。"
              : ""
          }`,
        },
        {
          role: "user",
          content: `${input.request}${goalContext}${brief ? `\n\n研究员简报(请充分吸收):\n${JSON.stringify(brief, null, 2)}` : ""}${attContext}`,
        },
      ],
      1024,
      0.5,
      sm.planner
    );
    spec = JSON.parse(extractJson(raw)) as AppSpec;
    yield { type: "plan", spec };
    yield { type: "stage", stage: "planner", status: "done", info: spec.name };
  }

  // ---- Stage 2: Engineer (streamed) ----
  yield { type: "stage", stage: "engineer", status: "start", model: modelBadge(sm.engineer) };
  const engineerSystemBase = `你是 Quark 平台的工程师智能体(Engineer),负责把产品需求实现为${
    isProject ? `多文件 React 工程(${isMobile ? "移动" : "网页"}应用)` : `单文件${isMobile ? "移动" : "网页"}应用`
  }。\n${isProject ? ENGINEER_RULES_PROJECT : ENGINEER_RULES}`;
  const engineerMessages: ChatMessage[] = [
    {
      role: "system",
      content: `${engineerSystemBase}${isMobile ? ENGINEER_RULES_MOBILE_EXTRA : ""}${
        input.theme
          ? `\n【主题规范】本项目的视觉主题固定为「${input.theme}」:配色、字体气质、圆角、阴影与背景必须符合该主题,且在后续所有修改中保持一致。`
          : ""
      }${
        input.connectors?.length
          ? `\n【连接器】本项目启用了以下平台连接器(发布后可用,预览沙箱可能不可用,必须做加载态与失败降级,失败时展示占位数据):\n${CONNECTORS.filter((c) => input.connectors!.includes(c.id))
              .map((c) => `- ${c.name}: ${c.doc}`)
              .join("\n")}\n调用统一通过 window.quark.connectors(存在性判断后使用),不得直接 fetch 外部网络。`
          : ""
      }`,
    },
  ];
  if (isIteration) {
    const recent = input.history
      .slice(-6)
      .map((m) => `${m.role === "user" ? "用户" : "智能体"}: ${m.content}`)
      .join("\n");
    const targetContext = input.target
      ? `\n\n【目标元素】用户在预览中点选了元素 \`${input.target.selector}\`${
          input.target.snippet ? `,其当前代码片段:\n${input.target.snippet}` : ""
        }\n本次修改必须聚焦该元素及其必要的关联逻辑(样式/事件/状态),页面其余部分保持原样,不做无关改动。`
      : "";
    engineerMessages.push({
      role: "user",
      content:
        isProject && files
          ? `这是当前工程的完整源码:\n\n${concatSources(files)}\n\n最近的对话:\n${recent}\n\n用户的新需求: ${input.request}${
              blueprint ? `\n\n架构师的变更蓝图(请遵循):\n${blueprint}` : ""
            }${targetContext}${attContext}\n\n请在保留现有功能与风格的基础上完成修改。${ENGINEER_RULES_PROJECT_ITERATE}`
          : `这是当前应用的完整代码:\n\n${input.currentHtml}\n\n最近的对话:\n${recent}\n\n用户的新需求: ${input.request}${
              blueprint ? `\n\n架构师的变更蓝图(请遵循):\n${blueprint}` : ""
            }${targetContext}${attContext}\n\n请在保留现有功能与风格的基础上完成修改,输出修改后的完整 HTML 文件。`,
    });
  } else if (fusionPlan && input.fusionSources?.length === 2) {
    const [a, b] = input.fusionSources;
    engineerMessages.push({
      role: "user",
      content: `聚变任务:把两个现有应用融合为一个全新的${isProject ? "多文件 React 工程" : "单文件应用"}。\n\n【应用 A「${a.name}」完整代码】\n${a.html.slice(0, 12_000)}\n\n【应用 B「${b.name}」完整代码】\n${b.html.slice(0, 12_000)}\n\n【聚变蓝图(请遵循)】\n${JSON.stringify(fusionPlan, null, 2)}\n\n用户需求:${input.request}${goalContext}${attContext}\n\n要求:产出的是重新设计的统一应用,不是两份代码的拼接 —— 统一信息架构、状态结构与视觉体系,融合两者核心能力。${isProject ? "按工程规范输出全部文件。" : "输出完整 HTML 文件。"}`,
    });
  } else {
    engineerMessages.push({
      role: "user",
      content: pmOut
        ? `PM 需求单:\n${JSON.stringify(pmOut, null, 2)}\n\n架构师蓝图(请遵循):\n${blueprint}\n\n用户原始需求: ${input.request}${goalContext}${attContext}\n\n请实现这个应用。${isProject ? "按工程规范输出全部文件。" : ""}`
        : `产品规格:\n${JSON.stringify(spec, null, 2)}\n\n用户原始需求: ${input.request}${goalContext}${attContext}\n\n请实现这个应用。${isProject ? "按工程规范输出全部文件。" : ""}`,
    });
  }

  let html = "";
  for await (const delta of chatStream(engineerMessages, 8192, 0.2, sm.engineer)) {
    html += delta;
    yield { type: "code_delta", delta };
  }
  if (isProject) {
    // ---- 工程模式: parse the multi-file stream, then the real build stage ----
    const parsed = parseFileStream(html);
    files = isIteration && files ? mergeFiles(files, parsed) : parsed.files;
    const invalid = validateFiles(files);
    if (invalid) throw new Error(`Engineer 产出的工程无效:${invalid}`);
    yield {
      type: "stage",
      stage: "engineer",
      status: "done",
      info: `${Object.keys(parsed.files).length} 个文件${parsed.deletes.length ? `,删除 ${parsed.deletes.length}` : ""}`,
    };

    yield { type: "stage", stage: "build", status: "start" };
    let built = await buildProject(files);
    let repairRounds = 0;
    while (!built.ok && repairRounds < 2) {
      repairRounds++;
      yield {
        type: "stage",
        stage: "build",
        status: "start",
        info: `${built.errors!.length} 个构建错误,回炉修复(第 ${repairRounds} 轮)`,
        model: modelBadge(sm.engineer),
      };
      let fixRaw = "";
      yield { type: "code_reset" };
      for await (const delta of chatStream(
        [
          { role: "system", content: `${engineerSystemBase}${ENGINEER_RULES_PROJECT_ITERATE}` },
          {
            role: "user",
            content: `工程构建失败,esbuild 报错如下:\n${formatBuildErrors(built.errors!)}\n\n当前工程源码:\n${concatSources(files)}\n\n请修复构建错误:只输出需要修改的文件(===== FILE: 路径 ===== + 完整内容)。`,
          },
        ],
        8192,
        0.2,
        sm.engineer
      )) {
        fixRaw += delta;
        yield { type: "code_delta", delta };
      }
      const fixParsed = parseFileStream(fixRaw);
      if (Object.keys(fixParsed.files).length || fixParsed.deletes.length) {
        const mergedFix = mergeFiles(files, fixParsed);
        if (!validateFiles(mergedFix)) files = mergedFix;
      }
      built = await buildProject(files);
    }
    if (!built.ok) {
      throw new Error(`构建失败(已修复 ${repairRounds} 轮):${formatBuildErrors(built.errors!).slice(0, 400)}`);
    }
    html = built.html!;
    yield {
      type: "stage",
      stage: "build",
      status: "done",
      info: `打包 ${built.meta.files} 个文件 → ${Math.round(built.meta.bundleBytes / 1024)}KB${
        repairRounds ? `,含 ${repairRounds} 轮修复` : ""
      }`,
    };
  } else {
    html = stripFences(html);
    if (!/^<!DOCTYPE html>/i.test(html) || html.length < 500) {
      throw new Error("Engineer 产出无效(不是完整 HTML)");
    }
    yield { type: "stage", stage: "engineer", status: "done", info: `${html.length} 字符` };
  }

  // ---- Stage 3: Reviewer(工程模式评审源码,结论仅记录;单文件模式可直接产出修正)----
  yield { type: "stage", stage: "reviewer", status: "start", model: modelBadge(sm.reviewer) };
  let reviewNotes = "";
  try {
    const review = await chat(
      [
        {
          role: "system",
          content: isProject
            ? `你是 Quark 平台的评审智能体(Reviewer)。检查一个多文件 React 工程的源码:是否有明显逻辑错误、是否引用了白名单外依赖或外部资源、交互是否完整、是否满足用户需求。
注意:window.quark.storage / window.quark.connectors 是平台在发布环境注入的合法 API(代码已做存在性判断与 localStorage 回退),不算违规依赖。
输出格式严格如下(只输出两行):
第一行: VERDICT: pass 或 VERDICT: fix
第二行: NOTES: 一句话结论(与用户语言一致,若 fix 需点明问题所在文件)`
            : `你是 Quark 平台的评审智能体(Reviewer)。检查一个单文件 HTML 应用:是否有明显 JS 错误、是否引用了外部资源、交互是否完整、是否满足用户需求。
输出格式严格如下:
第一行: VERDICT: pass 或 VERDICT: fix
第二行: NOTES: 一句话结论(与用户语言一致)
若为 fix,则从第三行起输出修正后的完整 HTML 文件(不要 markdown 围栏)。仅在存在会导致功能不可用的问题时才选择 fix。`,
        },
        {
          role: "user",
          content: `用户需求: ${input.request}\n\n待评审代码:\n\n${isProject && files ? concatSources(files) : html}`,
        },
      ],
      isProject ? 1024 : 8192,
      0.1,
      sm.reviewer
    );
    const verdictMatch = review.match(/VERDICT:\s*(pass|fix)/i);
    const notesMatch = review.match(/NOTES:\s*(.+)/);
    reviewNotes = notesMatch?.[1]?.trim() || "评审通过";
    if (!isProject && verdictMatch?.[1]?.toLowerCase() === "fix") {
      const idx = review.indexOf("<!DOCTYPE");
      if (idx !== -1) {
        const fixed = stripFences(review.slice(idx));
        if (fixed.length > 500) {
          html = fixed;
          yield { type: "code_reset" };
        }
      }
    }
  } catch {
    reviewNotes = "评审阶段跳过(不影响产物)";
  }
  yield { type: "stage", stage: "reviewer", status: "done", info: reviewNotes };

  // ---- Stage 4: Validator (runtime check in headless Chrome, one repair round) ----
  yield { type: "stage", stage: "validator", status: "start" };
  let validatorNotes: string;
  const v1 = await validateHtml(html, input.platform);
  if (v1.skipped) {
    validatorNotes = "校验环境不可用,跳过";
  } else if (v1.ok) {
    validatorNotes = "运行通过,无报错";
  } else if (isProject && files) {
    const fix = yield* projectFixRound(
      files,
      `工程构建产物在真实浏览器中运行时出现了错误:\n${v1.errors.map((e) => `- ${e}`).join("\n")}`,
      engineerSystemBase,
      sm.engineer
    );
    if (fix) {
      const v2 = await validateHtml(fix.html, input.platform);
      if (v2.skipped || v2.ok || v2.errors.length < v1.errors.length) {
        files = fix.files;
        html = fix.html;
        validatorNotes = `捕获 ${v1.errors.length} 个运行时错误并修复源码,复验${v2.ok || v2.skipped ? "通过" : `余 ${v2.errors.length} 项`}`;
      } else {
        validatorNotes = `修复未生效,保留原产物(${v1.errors.length} 个运行时错误)`;
      }
    } else {
      validatorNotes = `修复产出无效,保留原产物(${v1.errors.length} 个运行时错误)`;
    }
    // Leave the code pane showing the final source tree, not the fix fragment.
    yield { type: "code_reset" };
    yield { type: "code_delta", delta: concatSources(files) };
  } else {
    let fixed = "";
    yield { type: "code_reset" };
    for await (const delta of chatStream([
      {
        role: "system",
        content: `你是 Quark 平台的工程师智能体(Engineer)。\n${ENGINEER_RULES}${isMobile ? ENGINEER_RULES_MOBILE_EXTRA : ""}${
          input.theme ? `\n【主题规范】视觉主题固定为「${input.theme}」,修复时保持不变。` : ""
        }`,
      },
      {
        role: "user",
        content: `以下单文件应用在真实浏览器中运行时出现了错误。\n\n运行时错误:\n${v1.errors
          .map((e) => `- ${e}`)
          .join("\n")}\n\n当前代码:\n\n${html}\n\n请修复这些运行时错误,保持功能与视觉不变,输出修复后的完整 HTML 文件。`,
      },
      ],
      8192,
      0.2,
      sm.engineer
    )) {
      fixed += delta;
      yield { type: "code_delta", delta };
    }
    fixed = stripFences(fixed);
    if (/^<!DOCTYPE html>/i.test(fixed) && fixed.length > 500) {
      const v2 = await validateHtml(fixed, input.platform);
      if (v2.skipped || v2.ok) {
        html = fixed;
        validatorNotes = `捕获 ${v1.errors.length} 个运行时错误并修复,复验通过`;
      } else if (v2.errors.length < v1.errors.length) {
        html = fixed;
        validatorNotes = `修复后错误从 ${v1.errors.length} 降至 ${v2.errors.length}`;
      } else {
        validatorNotes = `修复未生效,保留原产物(${v1.errors.length} 个运行时错误)`;
      }
    } else {
      validatorNotes = "修复产出无效,保留原产物";
    }
  }

  // ---- Stage 4.5: acceptance-driven validation (PM 验收标准 -> 真实交互测试) ----
  const criteria = (pmOut?.acceptance ?? input.acceptance ?? [])
    .filter((s): s is string => typeof s === "string" && !!s.trim())
    .slice(0, 6);
  if (criteria.length) {
    let acceptanceNote: string;
    try {
      const cases = await buildAcceptanceCases(isProject && files ? concatSources(files) : html, criteria, sm.reviewer);
      const first = await runAcceptance(html, input.platform, cases);
      if (first.skipped) {
        acceptanceNote = "验收环境不可用,跳过";
      } else {
        let results = first.results;
        let repaired = false;
        const failed = results.filter((r) => !r.pass && !r.skipped);
        if (failed.length && isProject && files) {
          // One source-level repair round, rebuild, then re-test with the same cases.
          const fix = yield* projectFixRound(
            files,
            `自动化验收测试未通过以下标准:\n${failed.map((f) => `- ${f.criterion}(${f.note ?? "未通过"})`).join("\n")}\n修改时保持已通过的功能与现有元素的 id/class 不变。`,
            engineerSystemBase,
            sm.engineer
          );
          if (fix) {
            const rv = await validateHtml(fix.html, input.platform);
            if (rv.skipped || rv.ok) {
              const rerun = await runAcceptance(fix.html, input.platform, cases);
              const failCount = (rs: AcceptanceOutcome[]) => rs.filter((r) => !r.pass && !r.skipped).length;
              if (!rerun.skipped && failCount(rerun.results) < failed.length) {
                files = fix.files;
                html = fix.html;
                results = rerun.results;
                repaired = true;
              }
            }
          }
          yield { type: "code_reset" };
          yield { type: "code_delta", delta: concatSources(files) };
        } else if (failed.length) {
          // One repair round driven by the failing criteria, then re-test with the same cases.
          let fixed = "";
          yield { type: "code_reset" };
          for await (const delta of chatStream(
            [
              {
                role: "system",
                content: `你是 Quark 平台的工程师智能体(Engineer)。\n${ENGINEER_RULES}${isMobile ? ENGINEER_RULES_MOBILE_EXTRA : ""}${
                  input.theme ? `\n【主题规范】视觉主题固定为「${input.theme}」,修复时保持不变。` : ""
                }`,
              },
              {
                role: "user",
                content: `以下单文件应用在真实浏览器的自动化验收测试中未通过部分验收标准。\n\n未通过项:\n${failed
                  .map((f) => `- ${f.criterion}(${f.note ?? "未通过"})`)
                  .join("\n")}\n\n当前代码:\n\n${html}\n\n请修改代码使这些验收标准通过。保持已通过的功能、现有元素的 id/class 与视觉风格不变,输出修复后的完整 HTML 文件。`,
              },
            ],
            8192,
            0.2,
            sm.engineer
          )) {
            fixed += delta;
            yield { type: "code_delta", delta };
          }
          fixed = stripFences(fixed);
          if (/^<!DOCTYPE html>/i.test(fixed) && fixed.length > 500) {
            const rv = await validateHtml(fixed, input.platform);
            if (rv.skipped || rv.ok) {
              const rerun = await runAcceptance(fixed, input.platform, cases);
              const failCount = (rs: AcceptanceOutcome[]) => rs.filter((r) => !r.pass && !r.skipped).length;
              if (!rerun.skipped && failCount(rerun.results) < failed.length) {
                html = fixed;
                results = rerun.results;
                repaired = true;
              }
            }
          }
          if (!repaired) {
            yield { type: "code_reset" };
            yield { type: "code_delta", delta: html };
          }
        }
        const skippedN = results.filter((r) => r.skipped).length;
        const passN = results.filter((r) => r.pass && !r.skipped).length;
        acceptanceNote = `验收 ${passN}/${results.length - skippedN} 通过${skippedN ? `(${skippedN} 项无法自动验证)` : ""}${
          repaired ? ",含一轮修复" : ""
        }`;
        yield { type: "acceptance", results };
      }
    } catch {
      acceptanceNote = "验收测试异常,跳过(不影响产物)";
    }
    validatorNotes = `${validatorNotes};${acceptanceNote}`;
  }

  yield { type: "stage", stage: "validator", status: "done", info: validatorNotes };
  reviewNotes = reviewNotes ? `${reviewNotes};${validatorNotes}` : validatorNotes;

  if (isProject && files) yield { type: "files", files };
  yield { type: "html", html, reviewNotes };
  yield {
    type: "agent_message",
    content: isIteration
      ? `已完成本次修改:${input.request.slice(0, 80)}${reviewNotes ? `\n评审:${reviewNotes}` : ""}`
      : `「${spec?.name}」已生成:${spec?.summary}\n评审:${reviewNotes}`,
  };
}

export interface GoalEvalInput {
  goal: string;
  html: string;
  round: number;
  maxRounds: number;
  mode?: GenerationMode;
}

export interface GoalEvalResult {
  met: boolean;
  score: number;
  gaps: string[];
  next_request: string;
}

/** Goal-mode round judge: does the current app satisfy the project goal? */
export async function runGoalEval(input: GoalEvalInput): Promise<GoalEvalResult> {
  if (process.env.AGENT_MOCK === "1") {
    await new Promise((r) => setTimeout(r, 30));
    const met = !input.goal.includes("MOCK_NEVER_MET") && input.round >= 2;
    return met
      ? { met: true, score: 95, gaps: [], next_request: "" }
      : {
          met: false,
          score: 40,
          gaps: ["mock 缺口:目标尚未覆盖"],
          next_request: `继续补齐目标缺口(mock 第 ${input.round} 轮)`,
        };
  }
  const sm = stageModels(normalizeMode(input.mode));
  const raw = await chat(
    [
      {
        role: "system",
        content: `你是 Fusion 平台的目标评估智能体(Goal Judge)。用户为项目设定了一个目标,平台正在自动迭代构建;你负责判断当前应用是否已达成目标。判定要务实:目标要点已覆盖、核心功能可用即达标,不追求完美。严格输出 JSON(无其他文字):
{"met":true|false,"score":0-100 的完成度整数,"gaps":["未达标的具体缺口,达标时为空数组"],"next_request":"一段可直接交给工程师执行的下一轮迭代指令,达标时为空字符串"}
next_request 必须具体、可落地(改哪些区块/补什么功能),语言与目标一致。`,
      },
      {
        role: "user",
        content: `【目标】${input.goal}\n\n【进度】第 ${input.round}/${input.maxRounds} 轮\n\n【当前应用完整代码】\n${input.html.slice(0, 60_000)}`,
      },
    ],
    2048,
    0.2,
    sm.reviewer
  );
  const parsed = JSON.parse(extractJson(raw)) as Partial<GoalEvalResult>;
  if (typeof parsed.met !== "boolean") throw new Error("目标评估输出无效");
  return {
    met: parsed.met,
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.filter((g) => typeof g === "string").slice(0, 8) : [],
    next_request: typeof parsed.next_request === "string" ? parsed.next_request : "",
  };
}
