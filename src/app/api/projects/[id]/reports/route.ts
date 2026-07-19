import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const reports = db
    .prepare(
      "SELECT id, kind, content, status, artifact_seq, created_at FROM app_reports WHERE project_id = ? ORDER BY created_at DESC LIMIT 200"
    )
    .all(id);
  return NextResponse.json({ reports });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { ids, status } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0 || !["handled", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const update = db.prepare("UPDATE app_reports SET status = ? WHERE id = ? AND project_id = ?");
  for (const rid of ids.slice(0, 200)) {
    if (typeof rid === "string") update.run(status, rid, id);
  }
  return NextResponse.json({ ok: true });
}
