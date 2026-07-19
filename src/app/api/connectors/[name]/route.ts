import { runConnector } from "@/lib/connectors";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const rl = rateLimit(`conn:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return Response.json({ error: "请求过于频繁" }, { status: 429, headers: CORS });
  const { name } = await ctx.params;
  try {
    const { body, type } = await runConnector(name, new URL(req.url).searchParams);
    return new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=300", ...CORS } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "连接器错误" }, { status: 400, headers: CORS });
  }
}
