/**
 * 工程模式的文件树类型与 Engineer 输出流协议。
 * Engineer 以分段标记输出多文件;解析器把流切回文件树并做安全与限额校验。
 */

export type ProjectFiles = Record<string, string>;

export const FILE_MARKER = /^===== FILE: (.+?) =====\s*$/;
export const DELETE_MARKER = /^===== DELETE: (.+?) =====\s*$/;

export const MAX_FILES = 40;
export const MAX_FILE_BYTES = 64 * 1024;
export const MAX_TOTAL_BYTES = 256 * 1024;

const ALLOWED_EXT = new Set(["html", "css", "js", "jsx", "ts", "tsx", "json", "svg", "md"]);

/** Reject traversal/absolute paths and odd extensions; normalize separators. */
export function sanitizePath(raw: string): string | null {
  const p = raw.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!p || p.length > 120 || p.startsWith("/") || p.includes("..") || p.includes("\0")) return null;
  if (!/^[\w./-]+$/.test(p)) return null;
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) return null;
  return p;
}

export interface ParsedFileStream {
  files: ProjectFiles;
  deletes: string[];
  /** paths the model emitted but were rejected by sanitization */
  rejected: string[];
}

/** Split an Engineer output stream on FILE/DELETE markers into a file map. */
export function parseFileStream(text: string): ParsedFileStream {
  const files: ProjectFiles = {};
  const deletes: string[] = [];
  const rejected: string[] = [];
  let current: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current !== null) {
      // trim a single leading blank line and trailing whitespace
      files[current] = buf.join("\n").replace(/^\n/, "").replace(/\s+$/, "") + "\n";
    }
    buf = [];
  };
  for (const line of text.split("\n")) {
    const fm = line.match(FILE_MARKER);
    const dm = line.match(DELETE_MARKER);
    if (fm) {
      flush();
      const p = sanitizePath(fm[1]);
      if (p) current = p;
      else {
        rejected.push(fm[1].trim());
        current = null;
      }
      continue;
    }
    if (dm) {
      flush();
      current = null;
      const p = sanitizePath(dm[1]);
      if (p) deletes.push(p);
      else rejected.push(dm[1].trim());
      continue;
    }
    if (current !== null) buf.push(line);
  }
  flush();
  // Models sometimes fence a whole file's content; strip a wrapping code fence.
  for (const [p, content] of Object.entries(files)) {
    const m = content.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```\s*$/);
    if (m) files[p] = `${m[1]}\n`;
  }
  return { files, deletes, rejected };
}

/** Apply an iteration's parsed output (changed/new files + deletes) onto the previous tree. */
export function mergeFiles(prev: ProjectFiles, parsed: ParsedFileStream): ProjectFiles {
  const next: ProjectFiles = { ...prev };
  for (const p of parsed.deletes) delete next[p];
  for (const [p, content] of Object.entries(parsed.files)) next[p] = content;
  return next;
}

/** Enforce count/size caps; returns an error message or null. */
export function validateFiles(files: ProjectFiles): string | null {
  const entries = Object.entries(files);
  if (entries.length === 0) return "没有任何源文件";
  if (!files["index.html"]) return "缺少入口文件 index.html";
  if (entries.length > MAX_FILES) return `文件数超限(${entries.length} > ${MAX_FILES})`;
  let total = 0;
  for (const [p, content] of entries) {
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_FILE_BYTES) return `文件 ${p} 超过 ${MAX_FILE_BYTES / 1024}KB`;
    total += bytes;
  }
  if (total > MAX_TOTAL_BYTES) return `工程总量超过 ${MAX_TOTAL_BYTES / 1024}KB`;
  return null;
}

/** LLM-facing view of the tree (reviewer / acceptance / goal eval / iteration input). */
export function concatSources(files: ProjectFiles, maxBytes = 48_000): string {
  const parts: string[] = [];
  let used = 0;
  for (const [p, content] of Object.entries(files)) {
    const budget = maxBytes - used;
    if (budget <= 0) {
      parts.push(`===== FILE: ${p} =====\n(内容省略)`);
      continue;
    }
    const body = content.length > budget ? `${content.slice(0, budget)}\n…(截断)` : content;
    used += body.length;
    parts.push(`===== FILE: ${p} =====\n${body}`);
  }
  return parts.join("\n");
}

/** Parse a stored app_versions.files JSON column defensively. */
export function parseStoredFiles(raw: string | null | undefined): ProjectFiles | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const files: ProjectFiles = {};
      for (const [p, v] of Object.entries(obj)) {
        if (typeof v === "string") files[p] = v;
      }
      return Object.keys(files).length ? files : null;
    }
  } catch {
    // fall through
  }
  return null;
}
