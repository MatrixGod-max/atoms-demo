import { db } from "@/lib/db";
import { notFoundApp, serveAppHtml } from "@/lib/serveApp";

export const dynamic = "force-dynamic";

/** Serves a published app on its dedicated subdomain ({name}.apps-domain). */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const row = db
    .prepare(
      `SELECT v.html, p.slug, p.platform, p.connectors FROM projects p
       JOIN app_versions v ON v.id = p.published_version_id
       WHERE p.domain_name = ? AND p.published_version_id IS NOT NULL`
    )
    .get(name) as { html: string; slug: string; platform: "web" | "mobile"; connectors: string | null } | undefined;
  if (!row) return notFoundApp();
  // PWA surfaces are path-based; the subdomain serves the plain web app.
  return serveAppHtml(row.html, row.slug, { platform: "web", connectors: row.connectors });
}
