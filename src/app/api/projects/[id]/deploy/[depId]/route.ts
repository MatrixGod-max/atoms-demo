import { NextResponse } from "next/server";
import { demoGuard, getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { listDeployments, removeDeployment } from "@/lib/deploy";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; depId: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const blocked = demoGuard(user);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const { id, depId } = await ctx.params;
  if (!ownedProject(user.id, id)) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const record = listDeployments(id).find((d) => d.id === depId);
  if (!record || record.status !== "live") return NextResponse.json({ error: "部署记录不存在" }, { status: 404 });
  try {
    await removeDeployment(record);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "下线失败" }, { status: 502 });
  }
}
