import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoGuard, getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { jobRunner } from "@/lib/jobs";
import { now } from "@/lib/db";
import { listAttachments } from "@/lib/attachments";

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

  const { name, inGallery } = await req.json().catch(() => ({}));
  if (typeof name === "string" && name.trim()) {
    db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?").run(name.trim().slice(0, 40), now(), id);
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
