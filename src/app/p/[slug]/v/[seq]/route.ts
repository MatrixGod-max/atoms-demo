import { db } from "@/lib/db";
import { notFoundApp, serveAppHtml } from "@/lib/serveApp";

export const dynamic = "force-dynamic";

/** Immutable artifact snapshot. Only served while the project is published. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; seq: string }> }) {
  const { slug, seq } = await ctx.params;
  const seqNum = Number(seq);
  if (!Number.isInteger(seqNum) || seqNum < 1) return notFoundApp();
  const row = db
    .prepare(
      `SELECT v.html FROM projects p
       JOIN artifacts a ON a.project_id = p.id AND a.seq = ?
       JOIN app_versions v ON v.id = a.version_id
       WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
    )
    .get(seqNum, slug) as { html: string } | undefined;

  if (!row) return notFoundApp();
  return serveAppHtml(row.html, slug);
}
