import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { jobRunner } from "@/lib/jobs";

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
    activeJob: active ? { id: active.id, status: active.status, stage: active.stage } : null,
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!ownedProject(user.id, id)) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
