import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { rateLimit } from "@/lib/ratelimit";
import { DEPLOY_TARGETS, deployProject } from "@/lib/deploy";

export const dynamic = "force-dynamic";

const DAILY_DEPLOYS = 5;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (!project.published_version_id || !project.slug) {
    return NextResponse.json({ error: "请先发布,再部署到外部云" }, { status: 400 });
  }

  const { provider, token } = await req.json().catch(() => ({}));
  const target = DEPLOY_TARGETS.find((t) => t.id === provider);
  if (!target || target.status === "planned") {
    return NextResponse.json({ error: "该部署目标暂未开放" }, { status: 400 });
  }

  const rl = rateLimit(`deploy:${user.id}`, DAILY_DEPLOYS, 24 * 3600 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `外部部署每天最多 ${DAILY_DEPLOYS} 次` }, { status: 429 });

  const version = db.prepare("SELECT html FROM app_versions WHERE id = ?").get(project.published_version_id) as
    | { html: string }
    | undefined;
  const artifact = db
    .prepare("SELECT seq FROM artifacts WHERE project_id = ? AND version_id = ?")
    .get(id, project.published_version_id) as { seq: number } | undefined;
  if (!version) return NextResponse.json({ error: "发布版本缺失" }, { status: 500 });

  try {
    const dep = await deployProject(
      {
        projectId: id,
        slug: project.slug,
        platform: (db.prepare("SELECT platform FROM projects WHERE id = ?").get(id) as { platform: "web" | "mobile" })
          .platform,
        html: version.html,
        artifactSeq: artifact?.seq ?? 0,
        token: typeof token === "string" ? token : undefined,
      },
      provider
    );
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now(), id);
    return NextResponse.json({ ok: true, deployment: dep });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "部署失败" }, { status: 502 });
  }
}
