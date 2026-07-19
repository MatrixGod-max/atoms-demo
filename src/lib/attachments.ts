import { db } from "./db";

export const TEXT_MIMES = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);
export const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
export const MAX_TEXT_BYTES = 64 * 1024;
export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_PER_PROJECT = 6;

export interface AttachmentMeta {
  id: string;
  filename: string;
  mime: string;
  kind: "text" | "image";
  size: number;
}

export function attachmentKind(mime: string): "text" | "image" | null {
  if (TEXT_MIMES.has(mime)) return "text";
  if (IMAGE_MIMES.has(mime)) return "image";
  return null;
}

export function validateAttachment(mime: string, size: number, existingCount: number): string | null {
  const kind = attachmentKind(mime);
  if (!kind) return "仅支持文本(txt/md/csv/json)与图片(png/jpg/webp/svg)";
  if (existingCount >= MAX_PER_PROJECT) return `每个项目最多 ${MAX_PER_PROJECT} 个附件`;
  const cap = kind === "text" ? MAX_TEXT_BYTES : MAX_IMAGE_BYTES;
  if (size > cap) return `${kind === "text" ? "文本" : "图片"}附件不能超过 ${cap / 1024}KB`;
  if (size === 0) return "文件为空";
  return null;
}

export function listAttachments(projectId: string): AttachmentMeta[] {
  return db
    .prepare("SELECT id, filename, mime, kind, size FROM attachments WHERE project_id = ? ORDER BY created_at")
    .all(projectId)
    .map((r) => ({ ...r })) as unknown as AttachmentMeta[];
}

export interface PipelineAttachment {
  filename: string;
  kind: "text" | "image";
  mime: string;
  /** decoded content for text attachments */
  text?: string;
  /** data URI for image attachments */
  dataUri?: string;
}

export function loadPipelineAttachments(projectId: string): PipelineAttachment[] {
  const rows = db
    .prepare("SELECT filename, mime, kind, data FROM attachments WHERE project_id = ? ORDER BY created_at")
    .all(projectId) as { filename: string; mime: string; kind: "text" | "image"; data: Uint8Array }[];
  return rows.map((r) => {
    const buf = Buffer.from(r.data);
    return r.kind === "text"
      ? { filename: r.filename, kind: r.kind, mime: r.mime, text: buf.toString("utf8") }
      : { filename: r.filename, kind: r.kind, mime: r.mime, dataUri: `data:${r.mime};base64,${buf.toString("base64")}` };
  });
}

/** Replace asset://filename references the Engineer wrote with self-contained data URIs. */
export function inlineImageAssets(html: string, attachments: PipelineAttachment[]): string {
  let out = html;
  for (const a of attachments) {
    if (a.kind !== "image" || !a.dataUri) continue;
    out = out.split(`asset://${a.filename}`).join(a.dataUri);
  }
  return out;
}
