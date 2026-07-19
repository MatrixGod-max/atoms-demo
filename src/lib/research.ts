import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const FETCH_TIMEOUT_MS = 6_000;
const MAX_BODY_BYTES = 100 * 1024;
const MAX_EXCERPT_CHARS = 3_000;
const MAX_URLS = 2;

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"'()】)]+/g) ?? [];
  return [...new Set(matches)].slice(0, MAX_URLS);
}

/** true when the address must never be fetched server-side (SSRF guard). */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // ULA
  if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) return true;
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return false;
}

async function hostIsSafe(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return !isPrivateAddress(hostname);
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
  try {
    const addrs = await lookup(hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FetchedReference {
  url: string;
  excerpt: string;
}

/** Fetch user-supplied public URLs and reduce them to short text excerpts. */
export async function fetchReferences(request: string): Promise<FetchedReference[]> {
  const refs: FetchedReference[] = [];
  for (const url of extractUrls(request)) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (!(await hostIsSafe(parsed.hostname))) continue;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
        headers: { "user-agent": "QuarkResearcher/1.0" },
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain|application\/json/.test(type)) continue;
      const reader = res.body?.getReader();
      if (!reader) continue;
      let received = 0;
      const chunks: Uint8Array[] = [];
      while (received < MAX_BODY_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
      }
      reader.cancel().catch(() => {});
      const body = Buffer.concat(chunks).toString("utf8");
      const excerpt = (type.includes("html") ? stripHtml(body) : body).slice(0, MAX_EXCERPT_CHARS);
      if (excerpt.length > 50) refs.push({ url, excerpt });
    } catch {
      // unreachable or slow reference: skip silently
    }
  }
  return refs;
}
