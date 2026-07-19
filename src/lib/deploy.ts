import { randomBytes } from "node:crypto";
import { db, now } from "./db";
import { exportAppHtml } from "./serveApp";
import { deployToS3Website, removeS3Website } from "./s3";

/**
 * Unified deploy-target registry. "local" (Quark hosting on this machine) is the
 * default and is fulfilled by publishing itself; cloud targets export a
 * self-contained HTML and push it out. Additional clouds implement the same shape.
 */
export interface DeployTargetInfo {
  id: string;
  name: string;
  status: "available" | "experimental" | "planned";
  note: string;
}

export const DEPLOY_TARGETS: DeployTargetInfo[] = [
  { id: "local", name: "本机 · Atoms 托管", status: "available", note: "默认。发布即部署到 quark-apps 域,HTTPS + 云存储 + 制品体系" },
  { id: "s3", name: "AWS S3 静态托管", status: "available", note: "专属 bucket + 网站端点(HTTP)。应用云存储经 CORS 继续可用" },
  { id: "netlify", name: "Netlify", status: "experimental", note: "使用你自己的 Personal Access Token,仅本次请求使用不存储" },
  { id: "vercel", name: "Vercel", status: "planned", note: "接口已预留" },
  { id: "cloudflare", name: "Cloudflare Pages", status: "planned", note: "接口已预留" },
];

export interface DeploymentRow {
  id: string;
  project_id: string;
  artifact_seq: number;
  provider: string;
  bucket: string | null;
  url: string;
  status: "live" | "removed";
  created_at: number;
}

export function listDeployments(projectId: string): DeploymentRow[] {
  return db
    .prepare("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId)
    .map((r) => ({ ...r })) as unknown as DeploymentRow[];
}

interface DeployCtx {
  projectId: string;
  slug: string;
  platform: "web" | "mobile";
  html: string;
  artifactSeq: number;
  token?: string;
}

async function deployS3(ctx: DeployCtx): Promise<{ bucket: string; url: string }> {
  const bucket = `quark-app-${ctx.slug}-${randomBytes(3).toString("hex")}`;
  const html = exportAppHtml(ctx.html, ctx.slug, { platform: ctx.platform });
  const url = await deployToS3Website(bucket, html);
  return { bucket, url };
}

async function deployNetlify(ctx: DeployCtx): Promise<{ bucket: string | null; url: string }> {
  if (!ctx.token) throw new Error("需要 Netlify Personal Access Token");
  const html = exportAppHtml(ctx.html, ctx.slug, { platform: ctx.platform });
  // Minimal official flow: create site, then deploy files by digest.
  const siteRes = await fetch("https://api.netlify.com/api/v1/sites", {
    method: "POST",
    headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: `quark-${ctx.slug}-${randomBytes(2).toString("hex")}` }),
  });
  if (!siteRes.ok) throw new Error(`Netlify 建站失败 (${siteRes.status})`);
  const site = await siteRes.json();
  const { createHash } = await import("node:crypto");
  const sha = createHash("sha1").update(html).digest("hex");
  const depRes = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
    method: "POST",
    headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
    body: JSON.stringify({ files: { "/index.html": sha } }),
  });
  if (!depRes.ok) throw new Error(`Netlify 部署失败 (${depRes.status})`);
  const dep = await depRes.json();
  const upRes = await fetch(`https://api.netlify.com/api/v1/deploys/${dep.id}/files/index.html`, {
    method: "PUT",
    headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/octet-stream" },
    body: html,
  });
  if (!upRes.ok) throw new Error(`Netlify 上传失败 (${upRes.status})`);
  return { bucket: site.id, url: site.ssl_url || site.url };
}

export async function deployProject(ctx: DeployCtx, provider: string): Promise<DeploymentRow> {
  let result: { bucket: string | null; url: string };
  if (provider === "s3") result = await deployS3(ctx);
  else if (provider === "netlify") result = await deployNetlify(ctx);
  else throw new Error("该部署目标暂未开放");

  const id = `d_${randomBytes(6).toString("base64url")}`;
  db.prepare(
    "INSERT INTO deployments (id, project_id, artifact_seq, provider, bucket, url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'live', ?)"
  ).run(id, ctx.projectId, ctx.artifactSeq, provider, result.bucket, result.url, now());
  return listDeployments(ctx.projectId)[0];
}

export async function removeDeployment(record: DeploymentRow): Promise<void> {
  if (record.provider === "s3" && record.bucket) {
    await removeS3Website(record.bucket);
  }
  // netlify removal requires the user's token again; record is just marked removed.
  db.prepare("UPDATE deployments SET status = 'removed', removed_at = ? WHERE id = ?").run(now(), record.id);
}
