import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = db.prepare("SELECT html FROM templates WHERE id = ?").get(id) as { html: string } | undefined;
  if (!row) return new Response("not found", { status: 404 });
  return new Response(row.html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
