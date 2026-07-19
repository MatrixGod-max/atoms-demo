import { NextResponse } from "next/server";
import fs from "node:fs";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { nativeBuildRunner } from "@/lib/nativeBuild";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; buildId: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, buildId } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const build = nativeBuildRunner.get(buildId);
  if (!build || build.project_id !== id) return NextResponse.json({ error: "构建不存在" }, { status: 404 });
  if (build.status !== "done" || !build.artifact_path || !fs.existsSync(build.artifact_path)) {
    return NextResponse.json({ error: "产物不可用" }, { status: 404 });
  }
  const data = fs.readFileSync(build.artifact_path);
  const name = `${(project.slug ?? project.id).replace(/[^\w-]/g, "")}-${build.platform}.apk`;
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "application/vnd.android.package-archive",
      "content-disposition": `attachment; filename="${name}"`,
      "content-length": String(data.length),
      "cache-control": "no-store",
    },
  });
}
