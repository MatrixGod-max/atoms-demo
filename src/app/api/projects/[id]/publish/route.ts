import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { demoGuard, getUser, newId } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const blocked = demoGuard(user);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { action, artifactSeq } = await req.json().catch(() => ({}));

  if (action === "unpublish") {
    db.prepare("UPDATE projects SET published_version_id = NULL, updated_at = ? WHERE id = ?").run(now(), id);
    return NextResponse.json({ ok: true, slug: project.slug });
  }

  // Point the latest pointer back at an existing artifact (no new seq).
  if (action === "set_latest") {
    const artifact = db
      .prepare("SELECT version_id, seq FROM artifacts WHERE project_id = ? AND seq = ?")
      .get(id, Number(artifactSeq)) as { version_id: string; seq: number } | undefined;
    if (!artifact) return NextResponse.json({ error: "制品不存在" }, { status: 404 });
    db.prepare("UPDATE projects SET published_version_id = ?, updated_at = ? WHERE id = ?").run(
      artifact.version_id,
      now(),
      id
    );
    return NextResponse.json({ ok: true, slug: project.slug, seq: artifact.seq });
  }

  if (!project.current_version_id) {
    return NextResponse.json({ error: "还没有可发布的版本" }, { status: 400 });
  }
  const slug =
    project.slug ??
    randomBytes(5).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8).padEnd(6, "0");

  // Publishing the same version again is a no-op: return the existing artifact.
  const existing = db
    .prepare("SELECT seq FROM artifacts WHERE project_id = ? AND version_id = ? ORDER BY seq DESC")
    .get(id, project.current_version_id) as { seq: number } | undefined;
  let seq: number;
  if (existing && project.published_version_id === project.current_version_id) {
    seq = existing.seq;
  } else if (existing) {
    seq = existing.seq; // re-promoting a version that already has an artifact
  } else {
    seq =
      ((db.prepare("SELECT MAX(seq) AS m FROM artifacts WHERE project_id = ?").get(id) as { m: number | null }).m ??
        0) + 1;
    const version = db.prepare("SELECT prompt FROM app_versions WHERE id = ?").get(project.current_version_id) as
      | { prompt: string }
      | undefined;
    db.prepare(
      "INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(newId("a"), id, project.current_version_id, seq, version?.prompt ?? null, now());
  }

  db.prepare("UPDATE projects SET slug = ?, published_version_id = ?, updated_at = ? WHERE id = ?").run(
    slug,
    project.current_version_id,
    now(),
    id
  );
  return NextResponse.json({ ok: true, slug, seq });
}
