import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { versionId } = await req.json().catch(() => ({}));
  const version = db
    .prepare("SELECT id, html FROM app_versions WHERE id = ? AND project_id = ?")
    .get(String(versionId), id) as { id: string; html: string } | undefined;
  if (!version) return NextResponse.json({ error: "版本不存在" }, { status: 404 });

  db.prepare("UPDATE projects SET current_version_id = ?, updated_at = ? WHERE id = ?").run(version.id, now(), id);
  return NextResponse.json({ ok: true, html: version.html });
}
