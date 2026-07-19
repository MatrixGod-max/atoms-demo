/**
 * Connector registry: pure data, safe for client components (no server-only
 * imports). The API layer lives in connectors.ts, which re-exports this module.
 */

export interface ConnectorCredentialSpec {
  label: string;
  placeholder: string;
  /** 如何获取令牌的一句话指引 */
  help: string;
}

export interface ConnectorInfo {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** usage docs injected into the Engineer prompt when enabled */
  doc: string;
  /** token connectors are usable only in the owner's workbench preview */
  kind: "keyless" | "token";
  credential?: ConnectorCredentialSpec;
}

export const MAX_PROJECT_CONNECTORS = 8;

export const CONNECTORS: ConnectorInfo[] = [
  {
    id: "weather",
    icon: "🌦",
    name: "天气",
    desc: "实时天气与 7 日预报(open-meteo)",
    kind: "keyless",
    doc: `window.quark.connectors.weather({latitude, longitude})
→ Promise<{current:{temperature_2m,weather_code,wind_speed_10m},daily:{time[],temperature_2m_max[],temperature_2m_min[],weather_code[]}}>
经纬度可让用户输入城市预设(北京39.9,116.4/上海31.2,121.5/广州23.1,113.3/深圳22.5,114.1 等)。weather_code 按 WMO 标准映射文案。`,
  },
  {
    id: "rates",
    icon: "💱",
    name: "汇率",
    desc: "实时汇率换算(frankfurter)",
    kind: "keyless",
    doc: `window.quark.connectors.rates({from:"USD", to:"CNY,EUR"})
→ Promise<{base:"USD", rates:{CNY:number, EUR:number}, date:"YYYY-MM-DD"}>
支持 USD/CNY/EUR/JPY/GBP/HKD/KRW/AUD 等 ISO 货币码。`,
  },
  {
    id: "qr",
    icon: "🔲",
    name: "二维码",
    desc: "任意文本生成二维码(平台内置)",
    kind: "keyless",
    doc: `window.quark.connectors.qr({text:"内容"})
→ Promise<{svg:string}>,把 svg 字符串直接 innerHTML 到容器即可显示二维码。`,
  },
  {
    id: "gdrive",
    icon: "📁",
    name: "Google Drive",
    desc: "读取公开共享的文件 / 文档 / 表格(无需凭证)",
    kind: "keyless",
    doc: `window.quark.connectors.gdrive({fileId:"文件ID", type:"file"|"doc"|"sheet"})
→ Promise<{content:string, truncated:boolean, contentType:string}>
文件必须开启「知道链接的任何人可查看」;type=doc 导出纯文本、sheet 导出 CSV、file 直接下载文本内容。
fileId 取自分享链接 /d/{fileId}/ 段。未公开或超大文件会报错,必须 try/catch 并给出提示。`,
  },
  {
    id: "github",
    icon: "🐙",
    name: "GitHub",
    desc: "读取仓库信息 / Issues / 文件内容(需 PAT 🔑,仅工作台预览)",
    kind: "token",
    credential: {
      label: "GitHub 个人访问令牌 (PAT)",
      placeholder: "ghp_… 或 github_pat_…",
      help: "github.com → Settings → Developer settings → Personal access tokens,勾选仓库只读权限即可",
    },
    doc: `window.quark.connectors.github({op:"repo", repo:"owner/name"})
→ Promise<{full_name,description,stargazers_count,forks_count,open_issues_count,language,default_branch,html_url,updated_at}>
window.quark.connectors.github({op:"issues", repo:"owner/name", state:"open"|"closed"|"all"})
→ Promise<{issues:[{number,title,state,user,comments,labels,created_at,html_url}]}>(最多 20 条)
window.quark.connectors.github({op:"file", repo:"owner/name", path:"README.md"})
→ Promise<{path,size,content,truncated}>
仅工作台预览可用(需属主在 设置→连接器凭证 配置 GitHub PAT);发布后调用必定失败,必须 try/catch 并展示占位数据。`,
  },
  {
    id: "figma",
    icon: "🎨",
    name: "Figma",
    desc: "读取文件结构 / 渲染节点为图片(需个人令牌 🔑,仅工作台预览)",
    kind: "token",
    credential: {
      label: "Figma 个人访问令牌",
      placeholder: "figd_…",
      help: "Figma → Settings → Security → Personal access tokens 生成",
    },
    doc: `window.quark.connectors.figma({fileKey:"文件Key"})
→ Promise<{name,lastModified,pages:[{id,name,children:[{id,name,type}]}]}>
window.quark.connectors.figma({fileKey, nodeId:"1:2"})
→ Promise<{image: PNG图片网址|null}>(可直接作 <img src>)
fileKey 取自 figma.com/design/{fileKey}/ 段。仅工作台预览可用;发布后调用必定失败,必须 try/catch 降级。`,
  },
  {
    id: "notion",
    icon: "📓",
    name: "Notion",
    desc: "查询数据库 / 读取页面内容(需内部集成令牌 🔑,仅工作台预览)",
    kind: "token",
    credential: {
      label: "Notion 内部集成令牌",
      placeholder: "ntn_… 或 secret_…",
      help: "notion.so/my-integrations 创建内部集成,并在目标页面右上角 ⋯ → 连接 中添加该集成",
    },
    doc: `window.quark.connectors.notion({database_id:"32位ID"})
→ Promise<{rows:[{id, props:{列名: 值}}]}>(最多 20 行,值已拍平为 字符串/数字/布尔/数组)
window.quark.connectors.notion({page_id:"32位ID"})
→ Promise<{blocks:[{type, text}]}>(最多 50 块)
目标页面/数据库必须先「连接」给该集成。仅工作台预览可用;发布后调用必定失败,必须 try/catch 降级。`,
  },
  {
    id: "slack",
    icon: "💬",
    name: "Slack",
    desc: "向频道发送消息(需 Incoming Webhook 🔑,仅工作台预览)",
    kind: "token",
    credential: {
      label: "Slack Incoming Webhook 地址",
      placeholder: "https://hooks.slack.com/services/…",
      help: "api.slack.com/messaging/webhooks 创建 Incoming Webhook 后粘贴完整 URL",
    },
    doc: `window.quark.connectors.slack({text:"消息内容"})
→ Promise<{ok:true}>(text ≤500 字,每分钟最多发 5 条)
仅工作台预览可用;发布后调用必定失败。发送前后要有 UI 反馈(发送中/成功/失败降级)。`,
  },
];

export function parseConnectors(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((c) => CONNECTORS.some((k) => k.id === c)) : [];
  } catch {
    return [];
  }
}
