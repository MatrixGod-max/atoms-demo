import { db } from "@/lib/db";
import { notFoundApp, serveAppHtml } from "@/lib/serveApp";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const row = db
    .prepare(
      `SELECT v.html FROM projects p JOIN app_versions v ON v.id = p.published_version_id
       WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
    )
    .get(slug) as { html: string } | undefined;

  if (!row) return notFoundApp();
  return serveAppHtml(row.html, slug);
}
