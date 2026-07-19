import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { db, now } from "./db";
import { CONNECTORS } from "./connectorRegistry";

export { CONNECTORS, MAX_PROJECT_CONNECTORS, parseConnectors } from "./connectorRegistry";
export type { ConnectorInfo, ConnectorCredentialSpec } from "./connectorRegistry";

/**
 * Connector engine. Keyless connectors (weather/rates/qr/gdrive) proxy public
 * data with no auth. Token connectors (github/figma/notion/slack) use the
 * owner's stored credential and are reachable ONLY from the owner's workbench
 * preview via a short-lived preview token (the sandboxed preview iframe has an
 * opaque origin, so session cookies never arrive — a query-param token is the
 * only viable auth channel). Generated apps never call the internet directly.
 */

// ---- preview tokens (in-memory; single-process deployment, see DEPLOY.md) ----

interface PreviewGrant {
  userId: string;
  projectId: string;
  exp: number;
}

const gt = globalThis as unknown as { __quarkPreviewTokens?: Map<string, PreviewGrant> };
const previewTokens: Map<string, PreviewGrant> = gt.__quarkPreviewTokens ?? (gt.__quarkPreviewTokens = new Map());

export function mintPreviewToken(userId: string, projectId: string, ttlMs = 30 * 60_000): string {
  const t = now();
  for (const [k, v] of previewTokens) if (v.exp < t) previewTokens.delete(k);
  if (previewTokens.size > 2000) previewTokens.clear();
  const token = `pt_${randomBytes(18).toString("base64url")}`;
  previewTokens.set(token, { userId, projectId, exp: t + ttlMs });
  return token;
}

export function verifyPreviewToken(token: string | null): { userId: string; projectId: string } | null {
  if (!token) return null;
  const grant = previewTokens.get(token);
  if (!grant || grant.exp < now()) return null;
  return { userId: grant.userId, projectId: grant.projectId };
}

// ---- stored credentials ----
// Secrets live plaintext in the local SQLite: same trust domain as the password
// hashes and the DB file itself — an encryption key sitting beside the DB would
// add ceremony, not protection. No API ever returns the full secret.

export function getCredential(userId: string, connector: string): string | null {
  const row = db.prepare("SELECT secret FROM connector_credentials WHERE user_id = ? AND connector = ?").get(userId, connector) as
    | { secret: string }
    | undefined;
  return row?.secret ?? null;
}

export function maskSecret(s: string): string {
  return s.length <= 8 ? "••••••" : `${s.slice(0, 6)}……${s.slice(-2)}`;
}

export const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/\S+$/;

// ---- upstream cache ----

const cache = new Map<string, { at: number; body: string }>();
const CACHE_MS = 10 * 60_000;

async function cachedFetch(key: string, url: string, init?: RequestInit): Promise<string> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
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

const MOCK = () => process.env.CONNECTOR_MOCK === "1";
const REPO_RE = /^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/;
const CONTENT_CAP = 100_000;

export interface ConnectorCtx {
  secret?: string;
  userId?: string;
}

/** Executes a connector call with strict parameter whitelisting. */
export async function runConnector(
  name: string,
  params: URLSearchParams,
  ctx: ConnectorCtx = {}
): Promise<{ body: string; type: string }> {
  const json = (o: unknown) => ({ body: JSON.stringify(o), type: "application/json" });

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
    return json({ svg });
  }

  if (name === "gdrive") {
    const fileId = params.get("fileId") ?? "";
    const type = params.get("type") ?? "file";
    if (!/^[A-Za-z0-9_-]{10,80}$/.test(fileId)) throw new Error("fileId 参数无效");
    if (!["file", "doc", "sheet"].includes(type)) throw new Error("type 需为 file/doc/sheet");
    if (MOCK()) return json({ content: "mock drive content", truncated: false, contentType: "text/plain" });
    const url =
      type === "doc"
        ? `https://docs.google.com/document/d/${fileId}/export?format=txt`
        : type === "sheet"
          ? `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
          : `https://drive.google.com/uc?export=download&id=${fileId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`文件读取失败(${res.status}),请确认已开启「知道链接的任何人可查看」`);
    const contentType = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    if (contentType.includes("text/html") && (raw.includes("accounts.google.com") || raw.includes("download_warning") || raw.includes("uc-download-link"))) {
      throw new Error("文件未公开共享,或过大无法直接读取");
    }
    if (raw.length > 200_000) throw new Error("文件过大(>200KB),请改用更小的文件");
    return json({ content: raw.slice(0, CONTENT_CAP), truncated: raw.length > CONTENT_CAP, contentType });
  }

  if (name === "github") {
    const op = params.get("op") ?? "repo";
    const repo = params.get("repo") ?? "";
    if (!["repo", "issues", "file"].includes(op)) throw new Error("op 需为 repo/issues/file");
    if (!REPO_RE.test(repo)) throw new Error("repo 参数无效,格式应为 owner/name");
    const secret = requireSecret(ctx, "GitHub");
    const gh = (path: string, key: string) =>
      cachedFetch(`gh:${ctx.userId}:${key}`, `https://api.github.com${path}`, {
        headers: {
          authorization: `Bearer ${secret}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "quark-fusion",
        },
      });
    if (op === "repo") {
      if (MOCK())
        return json({ full_name: repo, description: "mock repo", stargazers_count: 1, forks_count: 0, open_issues_count: 2, language: "TypeScript", default_branch: "main", html_url: `https://github.com/${repo}`, updated_at: "2026-01-01T00:00:00Z" });
      const d = JSON.parse(await gh(`/repos/${repo}`, `repo:${repo}`));
      return json({
        full_name: d.full_name, description: d.description, stargazers_count: d.stargazers_count,
        forks_count: d.forks_count, open_issues_count: d.open_issues_count, language: d.language,
        default_branch: d.default_branch, html_url: d.html_url, updated_at: d.updated_at,
      });
    }
    if (op === "issues") {
      const state = params.get("state") ?? "open";
      if (!["open", "closed", "all"].includes(state)) throw new Error("state 需为 open/closed/all");
      if (MOCK()) return json({ issues: [{ number: 1, title: "mock issue", state: "open", user: "mock", comments: 0, labels: ["bug"], created_at: "2026-01-01T00:00:00Z", html_url: `https://github.com/${repo}/issues/1` }] });
      const arr = JSON.parse(await gh(`/repos/${repo}/issues?state=${state}&per_page=20`, `issues:${repo}:${state}`)) as Record<string, unknown>[];
      return json({
        issues: arr.slice(0, 20).map((i) => ({
          number: i.number, title: i.title, state: i.state,
          user: (i.user as { login?: string })?.login ?? "",
          comments: i.comments,
          labels: Array.isArray(i.labels) ? (i.labels as { name?: string }[]).map((l) => l.name ?? "") : [],
          created_at: i.created_at, html_url: i.html_url,
        })),
      });
    }
    // op === "file"
    const path = params.get("path") ?? "";
    if (!path || path.length > 300 || path.includes("..") || path.startsWith("/")) throw new Error("path 参数无效");
    if (MOCK()) return json({ path, size: 12, content: "mock content", truncated: false });
    const d = JSON.parse(await gh(`/repos/${repo}/contents/${path}`, `file:${repo}:${path}`));
    if (typeof d.size === "number" && d.size > 200_000) throw new Error("文件过大(>200KB)");
    if (typeof d.content !== "string") throw new Error("目标不是文件");
    const content = Buffer.from(d.content, "base64").toString("utf8");
    return json({ path, size: d.size, content: content.slice(0, CONTENT_CAP), truncated: content.length > CONTENT_CAP });
  }

  if (name === "figma") {
    const fileKey = params.get("fileKey") ?? "";
    const nodeId = params.get("nodeId");
    if (!/^[A-Za-z0-9]{8,64}$/.test(fileKey)) throw new Error("fileKey 参数无效");
    const secret = requireSecret(ctx, "Figma");
    const headers = { "x-figma-token": secret };
    if (nodeId) {
      if (!/^\d+[:-]\d+$/.test(nodeId)) throw new Error("nodeId 参数无效,形如 1:2");
      if (MOCK()) return json({ image: "https://mock.figma/img.png" });
      const d = JSON.parse(
        await cachedFetch(`fg:${ctx.userId}:img:${fileKey}:${nodeId}`, `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`, { headers })
      );
      return json({ image: d.images?.[nodeId.replace("-", ":")] ?? Object.values(d.images ?? {})[0] ?? null });
    }
    if (MOCK()) return json({ name: "Mock 设计稿", lastModified: "2026-01-01T00:00:00Z", pages: [{ id: "0:1", name: "Page 1", children: [{ id: "1:2", name: "Frame", type: "FRAME" }] }] });
    const d = JSON.parse(await cachedFetch(`fg:${ctx.userId}:file:${fileKey}`, `https://api.figma.com/v1/files/${fileKey}?depth=2`, { headers }));
    const pages = ((d.document?.children ?? []) as Record<string, unknown>[]).slice(0, 20).map((p) => ({
      id: p.id, name: p.name,
      children: ((p.children ?? []) as Record<string, unknown>[]).slice(0, 50).map((c) => ({ id: c.id, name: c.name, type: c.type })),
    }));
    return json({ name: d.name, lastModified: d.lastModified, pages });
  }

  if (name === "notion") {
    const dbId = normalizeNotionId(params.get("database_id"));
    const pageId = normalizeNotionId(params.get("page_id"));
    if (!dbId && !pageId) throw new Error("需提供 database_id 或 page_id(32 位 ID)");
    const secret = requireSecret(ctx, "Notion");
    const headers = { authorization: `Bearer ${secret}`, "notion-version": "2022-06-28", "content-type": "application/json" };
    if (dbId) {
      if (MOCK()) return json({ rows: [{ id: "mock-row", props: { 名称: "mock", 数量: 1 } }] });
      const d = JSON.parse(
        await cachedFetch(`nt:${ctx.userId}:db:${dbId}`, `https://api.notion.com/v1/databases/${dbId}/query`, {
          method: "POST", headers, body: JSON.stringify({ page_size: 20 }),
        })
      );
      const rows = ((d.results ?? []) as Record<string, unknown>[]).slice(0, 20).map((r) => ({
        id: r.id,
        props: flattenNotionProps((r.properties ?? {}) as Record<string, Record<string, unknown>>),
      }));
      return json({ rows });
    }
    if (MOCK()) return json({ blocks: [{ type: "paragraph", text: "mock 段落" }] });
    const d = JSON.parse(await cachedFetch(`nt:${ctx.userId}:pg:${pageId}`, `https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`, { headers }));
    const blocks = ((d.results ?? []) as Record<string, unknown>[]).slice(0, 50).map((b) => {
      const type = String(b.type ?? "");
      const rich = ((b[type] as { rich_text?: { plain_text?: string }[] })?.rich_text ?? []) as { plain_text?: string }[];
      return { type, text: rich.map((t) => t.plain_text ?? "").join("") };
    });
    return json({ blocks });
  }

  if (name === "slack") {
    const text = (params.get("text") ?? "").trim();
    if (!text || text.length > 500) throw new Error("text 参数无效(1-500 字符)");
    const secret = requireSecret(ctx, "Slack");
    if (!SLACK_WEBHOOK_RE.test(secret)) throw new Error("Webhook 地址无效,请重新配置");
    if (MOCK()) return json({ ok: true });
    const res = await fetch(secret, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Slack 发送失败(${res.status})`);
    return json({ ok: true });
  }

  throw new Error("未知连接器");
}

function requireSecret(ctx: ConnectorCtx, label: string): string {
  if (!ctx.secret) throw new Error(`未配置凭证:请到 设置 → 连接器凭证 添加 ${label} 令牌`);
  return ctx.secret;
}

function normalizeNotionId(v: string | null): string | null {
  if (!v) return null;
  const id = v.replace(/-/g, "");
  return /^[0-9a-f]{32}$/i.test(id) ? id : null;
}

/** title/rich_text → 拼接文本;number/checkbox → 原值;select/status → name;multi_select → names;date → start;url/email → 原值 */
function flattenNotionProps(props: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, p] of Object.entries(props)) {
    const type = String(p.type ?? "");
    const v = p[type];
    if (type === "title" || type === "rich_text") out[key] = ((v ?? []) as { plain_text?: string }[]).map((t) => t.plain_text ?? "").join("");
    else if (type === "number" || type === "checkbox" || type === "url" || type === "email") out[key] = v ?? null;
    else if (type === "select" || type === "status") out[key] = (v as { name?: string })?.name ?? null;
    else if (type === "multi_select") out[key] = ((v ?? []) as { name?: string }[]).map((s) => s.name ?? "");
    else if (type === "date") out[key] = (v as { start?: string })?.start ?? null;
  }
  return out;
}

/**
 * Injected client helper. With a preview token, token connectors call the API
 * carrying `pt`; without one (published/exported apps) they become reject stubs
 * so generated code fails fast with a clear Chinese message.
 */
export function connectorsHelper(enabled: string[], apiBase = "", previewToken?: string): string {
  if (!enabled.length) return "";
  const fns = enabled
    .map((c) => {
      const info = CONNECTORS.find((k) => k.id === c);
      if (!info) return "";
      if (info.kind === "token" && !previewToken) {
        return `${c}:function(){return Promise.reject(new Error('「${info.name}」连接器仅工作台预览可用'))}`;
      }
      const pt = info.kind === "token" ? `q.set('pt',${JSON.stringify(previewToken)});` : "";
      return `${c}:async function(p){var q=new URLSearchParams(p||{});${pt}var r=await fetch(b+'${c}'+'?'+q.toString());if(!r.ok){var e;try{e=(await r.json()).error}catch(x){}throw new Error(e||'connector ${c} '+r.status)}return r.json()}`;
    })
    .filter(Boolean);
  return `<script>(function(){var b=${JSON.stringify(apiBase)}+'/api/connectors/';window.quark=window.quark||{};window.quark.connectors={
${fns.join(",\n")}
};})()</script>`;
}
