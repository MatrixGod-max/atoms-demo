import { db } from "@/lib/db";
import { APP_DOMAIN_SUFFIX } from "@/lib/domains";

export const dynamic = "force-dynamic";

/**
 * Caddy on-demand TLS "ask" endpoint: only issue certificates for registered,
 * currently-published project domains (plus the primary apps host itself).
 */
export async function GET(req: Request) {
  const domain = (new URL(req.url).searchParams.get("domain") ?? "").toLowerCase();
  if (domain === APP_DOMAIN_SUFFIX) return new Response("ok");
  if (!domain.endsWith(`.${APP_DOMAIN_SUFFIX}`)) return new Response("no", { status: 404 });
  const name = domain.slice(0, -(APP_DOMAIN_SUFFIX.length + 1));
  if (name.includes(".")) return new Response("no", { status: 404 });
  const row = db
    .prepare("SELECT 1 FROM projects WHERE domain_name = ? AND published_version_id IS NOT NULL")
    .get(name);
  return row ? new Response("ok") : new Response("no", { status: 404 });
}
