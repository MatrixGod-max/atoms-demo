import QRCode from "qrcode";

/**
 * Real, key-less connectors. Generated apps never call the internet directly:
 * everything goes through /api/connectors/[name] (whitelist + cache + rate limit).
 */

export interface ConnectorInfo {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** usage docs injected into the Engineer prompt when enabled */
  doc: string;
}

export const CONNECTORS: ConnectorInfo[] = [
  {
    id: "weather",
    icon: "🌦",
    name: "天气",
    desc: "实时天气与 7 日预报(open-meteo)",
    doc: `window.quark.connectors.weather({latitude, longitude})
→ Promise<{current:{temperature_2m,weather_code,wind_speed_10m},daily:{time[],temperature_2m_max[],temperature_2m_min[],weather_code[]}}>
经纬度可让用户输入城市预设(北京39.9,116.4/上海31.2,121.5/广州23.1,113.3/深圳22.5,114.1 等)。weather_code 按 WMO 标准映射文案。`,
  },
  {
    id: "rates",
    icon: "💱",
    name: "汇率",
    desc: "实时汇率换算(frankfurter)",
    doc: `window.quark.connectors.rates({from:"USD", to:"CNY,EUR"})
→ Promise<{base:"USD", rates:{CNY:number, EUR:number}, date:"YYYY-MM-DD"}>
支持 USD/CNY/EUR/JPY/GBP/HKD/KRW/AUD 等 ISO 货币码。`,
  },
  {
    id: "qr",
    icon: "🔲",
    name: "二维码",
    desc: "任意文本生成二维码(平台内置)",
    doc: `window.quark.connectors.qr({text:"内容"})
→ Promise<{svg:string}>,把 svg 字符串直接 innerHTML 到容器即可显示二维码。`,
  },
];

export const PLANNED_CONNECTORS = ["GitHub", "Figma", "Google Drive", "Notion", "Slack"];

export function parseConnectors(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((c) => CONNECTORS.some((k) => k.id === c)) : [];
  } catch {
    return [];
  }
}

const cache = new Map<string, { at: number; body: string }>();
const CACHE_MS = 10 * 60_000;

async function cachedFetch(key: string, url: string): Promise<string> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const body = await res.text();
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 500) cache.clear();
  return body;
}

function num(v: string | null, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** Executes a connector call with strict parameter whitelisting. */
export async function runConnector(name: string, params: URLSearchParams): Promise<{ body: string; type: string }> {
  if (name === "weather") {
    const lat = num(params.get("latitude"), -90, 90);
    const lon = num(params.get("longitude"), -180, 180);
    if (lat === null || lon === null) throw new Error("latitude/longitude 参数无效");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
    return { body: await cachedFetch(`w:${lat.toFixed(2)},${lon.toFixed(2)}`, url), type: "application/json" };
  }
  if (name === "rates") {
    const from = (params.get("from") ?? "USD").toUpperCase();
    const to = (params.get("to") ?? "CNY").toUpperCase();
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}(,[A-Z]{3}){0,7}$/.test(to)) throw new Error("货币码无效");
    const url = `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`;
    return { body: await cachedFetch(`r:${from}:${to}`, url), type: "application/json" };
  }
  if (name === "qr") {
    const text = params.get("text") ?? "";
    if (!text || text.length > 1000) throw new Error("text 参数无效(1-1000 字符)");
    const svg = await QRCode.toString(text, { type: "svg", margin: 1, width: 240 });
    return { body: JSON.stringify({ svg }), type: "application/json" };
  }
  throw new Error("未知连接器");
}

/** Injected client helper for published apps with connectors enabled. */
export function connectorsHelper(enabled: string[], apiBase = ""): string {
  if (!enabled.length) return "";
  return `<script>(function(){var b=${JSON.stringify(apiBase)}+'/api/connectors/';window.quark=window.quark||{};window.quark.connectors={
${enabled
  .map(
    (c) =>
      `${c}:async function(p){var q=new URLSearchParams(p||{}).toString();var r=await fetch(b+'${c}'+(q?'?'+q:''));if(!r.ok)throw new Error('connector ${c} '+r.status);return r.json()}`
  )
  .join(",\n")}
};})()</script>`;
}
