import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoGuard, getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { listAttachments } from "@/lib/attachments";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; attId: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const blocked = demoGuard(user);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const { id, attId } = await ctx.params;
  if (!ownedProject(user.id, id)) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  db.prepare("DELETE FROM attachments WHERE id = ? AND project_id = ?").run(attId, id);
  return NextResponse.json({ ok: true, attachments: listAttachments(id) });
}
