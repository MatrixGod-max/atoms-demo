import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Visitor feedback / runtime-error beacon for published apps (also from external deploys).
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const MAX_CONTENT = 500;
const MAX_REPORTS_PER_APP = 200;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const rl = rateLimit(`report:${clientIp(req)}:${slug}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "提交过于频繁" }, { status: 429, headers: CORS });

  const project = db
    .prepare("SELECT id FROM projects WHERE slug = ? AND published_version_id IS NOT NULL")
    .get(slug) as { id: string } | undefined;
  if (!project) return NextResponse.json({ error: "应用不存在" }, { status: 404, headers: CORS });

  const { kind, content } = await req.json().catch(() => ({}));
  if (kind !== "feedback" && kind !== "error") {
    return NextResponse.json({ error: "kind 必须是 feedback 或 error" }, { status: 400, headers: CORS });
  }
  const text = typeof content === "string" ? content.trim().slice(0, MAX_CONTENT) : "";
  if (!text) return NextResponse.json({ error: "内容不能为空" }, { status: 400, headers: CORS });

  // The same runtime error fires for every visitor — keep one open row per message.
  if (kind === "error") {
    const dup = db
      .prepare("SELECT 1 FROM app_reports WHERE project_id = ? AND kind = 'error' AND content = ? AND status = 'new'")
      .get(project.id, text);
    if (dup) return NextResponse.json({ ok: true, deduped: true }, { headers: CORS });
  }
  const count = (db.prepare("SELECT COUNT(*) AS c FROM app_reports WHERE project_id = ?").get(project.id) as { c: number }).c;
  if (count >= MAX_REPORTS_PER_APP) {
    return NextResponse.json({ error: "该应用的反馈箱已满" }, { status: 429, headers: CORS });
  }
  const seq = (db.prepare("SELECT MAX(seq) AS m FROM artifacts WHERE project_id = ?").get(project.id) as { m: number | null }).m;
  db.prepare(
    "INSERT INTO app_reports (id, project_id, artifact_seq, kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(newId("r"), project.id, seq, kind, text, now());
  return NextResponse.json({ ok: true }, { headers: CORS });
}
