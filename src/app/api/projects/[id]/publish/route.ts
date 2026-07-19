import { randomBytes } from "node:crypto";
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

  const { action } = await req.json().catch(() => ({}));
  if (action === "unpublish") {
    db.prepare("UPDATE projects SET published_version_id = NULL, updated_at = ? WHERE id = ?").run(now(), id);
    return NextResponse.json({ ok: true, slug: project.slug });
  }
  if (!project.current_version_id) {
    return NextResponse.json({ error: "还没有可发布的版本" }, { status: 400 });
  }
  const slug = project.slug ?? randomBytes(5).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8).padEnd(6, "0");
  db.prepare("UPDATE projects SET slug = ?, published_version_id = ?, updated_at = ? WHERE id = ?").run(
    slug,
    project.current_version_id,
    now(),
    id
  );
  return NextResponse.json({ ok: true, slug });
}
