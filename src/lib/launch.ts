export const THEME_PRESETS = ["深色", "浅色", "多巴胺", "莫兰迪", "像素复古", "极简黑白", "毛玻璃"];

/* Client-side mirror of the limits in src/lib/attachments.ts (which imports the server db). */
export const CLIENT_TEXT_MIMES = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);
export const CLIENT_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
export const CLIENT_MAX_TEXT_BYTES = 64 * 1024;
export const CLIENT_MAX_IMAGE_BYTES = 512 * 1024;
export const CLIENT_MAX_ATTACHMENTS = 6;

/** Same extension fallback the Builder uses for files browsers report without a mime type. */
export function inferMime(file: File): string {
  return file.type || (file.name.endsWith(".md") ? "text/markdown" : "text/plain");
}

/** Returns an error string, or null if the file is acceptable. */
export function precheckFile(file: File, existingCount: number): string | null {
  const mime = inferMime(file);
  const isText = CLIENT_TEXT_MIMES.has(mime);
  const isImage = CLIENT_IMAGE_MIMES.has(mime);
  if (!isText && !isImage) return "仅支持文本(txt/md/csv/json)与图片(png/jpg/webp/svg)";
  if (existingCount >= CLIENT_MAX_ATTACHMENTS) return `每个项目最多 ${CLIENT_MAX_ATTACHMENTS} 个附件`;
  const cap = isText ? CLIENT_MAX_TEXT_BYTES : CLIENT_MAX_IMAGE_BYTES;
  if (file.size > cap) return `${isText ? "文本" : "图片"}附件不能超过 ${cap / 1024}KB`;
  if (file.size === 0) return "文件为空";
  return null;
}

export interface LaunchOptions {
  research?: boolean;
  team?: boolean;
  theme?: string | null;
  mode?: "fast" | "mixed" | "deep";
  connectors?: string[];
  goal?: string | null;
  engine?: "single" | "project";
}

/** Base64-encodes a File without blowing the call stack on large buffers. */
export async function encodeFileBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Creates a project from a prompt and stashes the first-generation payload for the Builder.
 * The theme suffix goes only into the generation prompt — the project name is derived from
 * the raw prompt server-side.
 */
export async function launchProject(
  prompt: string,
  platform: "web" | "mobile" = "web",
  opts: LaunchOptions = {}
): Promise<{ id: string } | { error: string }> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      platform,
      theme: opts.theme ?? null,
      connectors: opts.connectors ?? [],
      goal: opts.goal ?? null,
      engine: opts.engine ?? "project",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || `创建失败 (${res.status})` };
  sessionStorage.setItem(
    `quark_pending_${data.id}`,
    JSON.stringify({ prompt, research: !!opts.research, team: !!opts.team, mode: opts.mode ?? "fast", goal: !!opts.goal })
  );
  return { id: data.id };
}
