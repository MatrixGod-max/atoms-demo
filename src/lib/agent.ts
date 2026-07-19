/**
 * Quark agent pipeline: Planner -> Engineer -> Reviewer.
 * Each run yields typed events that the API route forwards as SSE.
 */

const API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

import { validateHtml } from "./validate";

export type AgentEvent =
  | { type: "stage"; stage: "planner" | "engineer" | "reviewer" | "validator"; status: "start" | "done"; info?: string }
  | { type: "plan"; spec: AppSpec }
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

async function chat(messages: ChatMessage[], maxTokens = 4096, temperature = 0.3): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}

async function* chatStream(
  messages: ChatMessage[],
  maxTokens = 8192,
  temperature = 0.2
): AsyncGenerator<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature, stream: true }),
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

const ENGINEER_RULES = `输出规则(必须严格遵守):
1. 只输出一个完整的、自包含的 HTML 文件,从 <!DOCTYPE html> 开始。不要输出任何 markdown 代码围栏或解释文字。
2. 所有 CSS 和 JavaScript 必须内联在该文件中,禁止引用任何外部资源(CDN、字体、图片 URL 等),图标可用 emoji 或内联 SVG。
3. 应用必须具备真实交互(增删改查、状态变化等),不能是静态展示页。
4. 数据持久化:优先使用平台注入的 \`window.quark.storage\`(async get(key)/set(key,value),字符串值,发布后所有访客共享)——用法:\`if(window.quark&&window.quark.storage){...}\`;不可用时回退 localStorage。两种访问都必须包在 try/catch 中,存取失败时应用仍要能正常使用(内存态)。
5. 视觉设计要现代、精致:合理的间距与层级、和谐配色、hover/过渡效果、移动端可用(响应式)。
6. 代码健壮:处理空状态(无数据时的引导提示)、非法输入,不允许出现未捕获异常。
7. 界面语言与用户需求的语言一致。`;

export interface PipelineInput {
  request: string;
  history: { role: "user" | "agent"; content: string }[];
  currentHtml: string | null;
  specJson: string | null;
}

/** Deterministic, LLM-free pipeline for tests/CI (AGENT_MOCK=1). */
async function* runMockPipeline(input: PipelineInput): AsyncGenerator<AgentEvent> {
  const isIteration = !!input.currentHtml;
  const broken = input.request.includes("MOCK_BROKEN");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  if (!isIteration) {
    yield { type: "stage", stage: "planner", status: "start" };
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
  yield { type: "stage", stage: "engineer", status: "start" };
  let html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mock 计数器</title>
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
  yield { type: "stage", stage: "reviewer", status: "start" };
  await sleep(50);
  yield { type: "stage", stage: "reviewer", status: "done", info: "mock 评审通过" };

  yield { type: "stage", stage: "validator", status: "start" };
  let validatorNotes = "运行通过,无报错";
  const v1 = await validateHtml(html);
  if (v1.skipped) {
    validatorNotes = "校验环境不可用,跳过";
  } else if (!v1.ok) {
    html = html.replace(/<script>throw[^<]*<\/script>/, "");
    yield { type: "code_reset" };
    yield { type: "code_delta", delta: html };
    const v2 = await validateHtml(html);
    validatorNotes = `捕获 ${v1.errors.length} 个运行时错误并修复(复验${v2.ok ? "通过" : "未过"})`;
  }
  yield { type: "stage", stage: "validator", status: "done", info: validatorNotes };
  yield { type: "html", html, reviewNotes: `mock 评审通过;${validatorNotes}` };
  yield { type: "agent_message", content: isIteration ? "mock 迭代完成" : "「Mock 计数器」已生成" };
}

export async function* runPipeline(input: PipelineInput): AsyncGenerator<AgentEvent> {
  if (process.env.AGENT_MOCK === "1") {
    yield* runMockPipeline(input);
    return;
  }
  const isIteration = !!input.currentHtml;
  let spec: AppSpec | null = input.specJson ? (JSON.parse(input.specJson) as AppSpec) : null;

  // ---- Stage 1: Planner (first generation only) ----
  if (!isIteration) {
    yield { type: "stage", stage: "planner", status: "start" };
    const raw = await chat(
      [
        {
          role: "system",
          content: `你是 Quark 平台的产品规划智能体(Planner)。用户会描述一个网页应用的想法,你需要输出一份精炼的产品规格,严格输出 JSON(无其他文字):
{"name": "应用名(<=12字)", "summary": "一句话定位", "features": ["3-5个核心功能点"], "design": "一句话视觉方向"}
语言与用户输入一致。规格要克制务实:只保留一次生成能落地的功能。`,
        },
        { role: "user", content: input.request },
      ],
      1024,
      0.5
    );
    spec = JSON.parse(extractJson(raw)) as AppSpec;
    yield { type: "plan", spec };
    yield { type: "stage", stage: "planner", status: "done", info: spec.name };
  }

  // ---- Stage 2: Engineer (streamed) ----
  yield { type: "stage", stage: "engineer", status: "start" };
  const engineerMessages: ChatMessage[] = [
    { role: "system", content: `你是 Quark 平台的工程师智能体(Engineer),负责把产品需求实现为单文件网页应用。\n${ENGINEER_RULES}` },
  ];
  if (isIteration) {
    const recent = input.history
      .slice(-6)
      .map((m) => `${m.role === "user" ? "用户" : "智能体"}: ${m.content}`)
      .join("\n");
    engineerMessages.push({
      role: "user",
      content: `这是当前应用的完整代码:\n\n${input.currentHtml}\n\n最近的对话:\n${recent}\n\n用户的新需求: ${input.request}\n\n请在保留现有功能与风格的基础上完成修改,输出修改后的完整 HTML 文件。`,
    });
  } else {
    engineerMessages.push({
      role: "user",
      content: `产品规格:\n${JSON.stringify(spec, null, 2)}\n\n用户原始需求: ${input.request}\n\n请实现这个应用。`,
    });
  }

  let html = "";
  for await (const delta of chatStream(engineerMessages)) {
    html += delta;
    yield { type: "code_delta", delta };
  }
  html = stripFences(html);
  if (!/^<!DOCTYPE html>/i.test(html) || html.length < 500) {
    throw new Error("Engineer 产出无效(不是完整 HTML)");
  }
  yield { type: "stage", stage: "engineer", status: "done", info: `${html.length} 字符` };

  // ---- Stage 3: Reviewer ----
  yield { type: "stage", stage: "reviewer", status: "start" };
  let reviewNotes = "";
  try {
    const review = await chat(
      [
        {
          role: "system",
          content: `你是 Quark 平台的评审智能体(Reviewer)。检查一个单文件 HTML 应用:是否有明显 JS 错误、是否引用了外部资源、交互是否完整、是否满足用户需求。
输出格式严格如下:
第一行: VERDICT: pass 或 VERDICT: fix
第二行: NOTES: 一句话结论(与用户语言一致)
若为 fix,则从第三行起输出修正后的完整 HTML 文件(不要 markdown 围栏)。仅在存在会导致功能不可用的问题时才选择 fix。`,
        },
        { role: "user", content: `用户需求: ${input.request}\n\n待评审代码:\n\n${html}` },
      ],
      8192,
      0.1
    );
    const verdictMatch = review.match(/VERDICT:\s*(pass|fix)/i);
    const notesMatch = review.match(/NOTES:\s*(.+)/);
    reviewNotes = notesMatch?.[1]?.trim() || "评审通过";
    if (verdictMatch?.[1]?.toLowerCase() === "fix") {
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
  const v1 = await validateHtml(html);
  if (v1.skipped) {
    validatorNotes = "校验环境不可用,跳过";
  } else if (v1.ok) {
    validatorNotes = "运行通过,无报错";
  } else {
    let fixed = "";
    yield { type: "code_reset" };
    for await (const delta of chatStream([
      { role: "system", content: `你是 Quark 平台的工程师智能体(Engineer)。\n${ENGINEER_RULES}` },
      {
        role: "user",
        content: `以下单文件应用在真实浏览器中运行时出现了错误。\n\n运行时错误:\n${v1.errors
          .map((e) => `- ${e}`)
          .join("\n")}\n\n当前代码:\n\n${html}\n\n请修复这些运行时错误,保持功能与视觉不变,输出修复后的完整 HTML 文件。`,
      },
    ])) {
      fixed += delta;
      yield { type: "code_delta", delta };
    }
    fixed = stripFences(fixed);
    if (/^<!DOCTYPE html>/i.test(fixed) && fixed.length > 500) {
      const v2 = await validateHtml(fixed);
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
  yield { type: "stage", stage: "validator", status: "done", info: validatorNotes };
  reviewNotes = reviewNotes ? `${reviewNotes};${validatorNotes}` : validatorNotes;

  yield { type: "html", html, reviewNotes };
  yield {
    type: "agent_message",
    content: isIteration
      ? `已完成本次修改:${input.request.slice(0, 80)}${reviewNotes ? `\n评审:${reviewNotes}` : ""}`
      : `「${spec?.name}」已生成:${spec?.summary}\n评审:${reviewNotes}`,
  };
}
