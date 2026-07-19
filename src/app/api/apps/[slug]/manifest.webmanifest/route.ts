import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const project = db
    .prepare("SELECT name FROM projects WHERE slug = ? AND published_version_id IS NOT NULL")
    .get(slug) as { name: string } | undefined;
  if (!project) return Response.json({ error: "not found" }, { status: 404 });

  const manifest = {
    id: `/${slug}`,
    name: project.name,
    short_name: project.name.slice(0, 12),
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: "standalone",
    background_color: "#0d0e1c",
    theme_color: "#0d0e1c",
    icons: [
      { src: `/api/apps/${slug}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: `/api/apps/${slug}/icon.svg`, sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "no-cache" },
  });
}
