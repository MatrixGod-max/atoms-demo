import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Fusion Cloud 公网入口:/c/{slug}/* 反代 214 静态托管(仅实例 running 时)。 */
const CLOUD_URL = (process.env.CLOUD_SERVICE_URL || "http://10.234.201.214:8070").replace(/\/$/, "");
const MOCK = process.env.CLOUD_MOCK === "1";

function statusPage(title: string, body: string, status = 404): Response {
  return new Response(
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:8px"><h1>☁️ ${title}</h1><p>${body}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return statusPage("404", "该云实例不存在。");
  const inst = db.prepare("SELECT status FROM cloud_instances WHERE slug = ?").get(slug) as
    | { status: string }
    | undefined;
  if (!inst) return statusPage("404", "该云实例不存在或已删除。");
  if (inst.status === "stopped") return statusPage("实例已停止", "属主可在工作台 ☁️ 云面板重新启动。", 503);
  if (inst.status !== "running") return statusPage("实例未就绪", "正在部署或部署失败,请稍后再试。", 503);

  if (MOCK) {
    return new Response(`<!DOCTYPE html><html><body><h1>mock cloud app ${slug}</h1></body></html>`, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const rel = (path ?? []).map(encodeURIComponent).join("/");
  try {
    const upstream = await fetch(`${CLOUD_URL}/${slug}/${rel}${new URL(req.url).search}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const headers = new Headers();
    for (const h of ["content-type", "cache-control"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return statusPage("云服务不可达", "Fusion Cloud 托管节点暂时无响应,请稍后再试。", 502);
  }
}
