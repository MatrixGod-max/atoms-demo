import { CONNECTORS, getCredential, runConnector, verifyPreviewToken } from "@/lib/connectors";
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
  const params = new URL(req.url).searchParams;
  const info = CONNECTORS.find((c) => c.id === name);

  try {
    if (info?.kind === "token") {
      const auth = verifyPreviewToken(params.get("pt"));
      if (!auth) {
        return Response.json(
          { error: "该连接器仅在工作台预览中可用;若预览已过期请刷新工作台" },
          { status: 403, headers: CORS }
        );
      }
      const secret = getCredential(auth.userId, name);
      if (!secret) {
        return Response.json(
          { error: `未配置凭证:请到 设置 → 连接器凭证 添加「${info.name}」令牌` },
          { status: 400, headers: CORS }
        );
      }
      if (name === "slack") {
        const srl = rateLimit(`connslack:${auth.userId}`, 5, 60_000);
        if (!srl.ok) return Response.json({ error: "Slack 发送过于频繁(每分钟最多 5 条)" }, { status: 429, headers: CORS });
      }
      params.delete("pt");
      const { body, type } = await runConnector(name, params, { secret, userId: auth.userId });
      return new Response(body, { headers: { "content-type": type, "cache-control": "private, no-store", ...CORS } });
    }

    const { body, type } = await runConnector(name, params);
    return new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=300", ...CORS } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "连接器错误" }, { status: 400, headers: CORS });
  }
}
