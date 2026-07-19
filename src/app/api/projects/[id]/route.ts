import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoGuard, getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { jobRunner } from "@/lib/jobs";
import { now } from "@/lib/db";
import { listAttachments } from "@/lib/attachments";
import { listDeployments, DEPLOY_TARGETS } from "@/lib/deploy";
import { validateDomainName } from "@/lib/domains";
import { CONNECTORS } from "@/lib/connectors";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const messages = db
    .prepare("SELECT id, role, content, meta, created_at FROM messages WHERE project_id = ? ORDER BY created_at")
    .all(id);
  const versions = db
    .prepare("SELECT id, num, review_notes, prompt, created_at, LENGTH(html) AS size FROM app_versions WHERE project_id = ? ORDER BY num")
    .all(id);
  const current = project.current_version_id
    ? (db.prepare("SELECT html FROM app_versions WHERE id = ?").get(project.current_version_id) as
        | { html: string }
        | undefined)
    : undefined;

  const active = jobRunner.activeJobForProject(id);
  return NextResponse.json({
    project,
    messages,
    versions,
    currentHtml: current?.html ?? null,
    attachments: listAttachments(id),
    deployments: listDeployments(id),
    deployTargets: DEPLOY_TARGETS,
    activeJob: active ? { id: active.id, status: active.status, stage: active.stage } : null,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const blocked = demoGuard(user);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const { id } = await ctx.params;
  if (!ownedProject(user.id, id)) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { name, inGallery, platform, theme, connectors, domainName } = await req.json().catch(() => ({}));
  if (typeof name === "string" && name.trim()) {
    db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?").run(name.trim().slice(0, 40), now(), id);
  }
  if (theme === null || (typeof theme === "string" && theme.trim())) {
    db.prepare("UPDATE projects SET theme = ?, updated_at = ? WHERE id = ?").run(
      theme === null ? null : theme.trim().slice(0, 20),
      now(),
      id
    );
  }
  if (platform === "web" || platform === "mobile") {
    db.prepare("UPDATE projects SET platform = ?, updated_at = ? WHERE id = ?").run(platform, now(), id);
  }
  if (Array.isArray(connectors)) {
    const valid = connectors.filter((c) => CONNECTORS.some((k) => k.id === c)).slice(0, 5);
    db.prepare("UPDATE projects SET connectors = ?, updated_at = ? WHERE id = ?").run(
      valid.length ? JSON.stringify(valid) : null,
      now(),
      id
    );
  }
  if (domainName === null) {
    db.prepare("UPDATE projects SET domain_name = NULL, updated_at = ? WHERE id = ?").run(now(), id);
  } else if (typeof domainName === "string") {
    const dn = domainName.trim().toLowerCase();
    const invalid = validateDomainName(dn);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const taken = db.prepare("SELECT 1 FROM projects WHERE domain_name = ? AND id != ?").get(dn, id);
    if (taken) return NextResponse.json({ error: "该域名已被占用,请换一个" }, { status: 409 });
    db.prepare("UPDATE projects SET domain_name = ?, updated_at = ? WHERE id = ?").run(dn, now(), id);
  }
  if (typeof inGallery === "boolean") {
    db.prepare("UPDATE projects SET in_gallery = ? WHERE id = ?").run(inGallery ? 1 : 0, id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const blocked = demoGuard(user);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const { id } = await ctx.params;
  if (!ownedProject(user.id, id)) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
