import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Apps deployed to external origins (S3 websites etc.) still use this KV API.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, PUT, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const MAX_VALUE_BYTES = 8 * 1024;
const MAX_KEYS_PER_APP = 64;

function publishedProject(slug: string): { id: string } | undefined {
  return db
    .prepare("SELECT id FROM projects WHERE slug = ? AND published_version_id IS NOT NULL")
    .get(slug) as { id: string } | undefined;
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; key: string }> }) {
  const { slug, key } = await ctx.params;
  const project = publishedProject(slug);
  if (!project) return NextResponse.json({ error: "应用不存在" }, { status: 404, headers: CORS });
  const row = db.prepare("SELECT v FROM app_kv WHERE project_id = ? AND k = ?").get(project.id, key) as
    | { v: string }
    | undefined;
  if (!row) return NextResponse.json({ v: null }, { status: 404, headers: CORS });
  return NextResponse.json({ v: row.v }, { headers: CORS });
}

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string; key: string }> }) {
  const rl = rateLimit(`kv:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "写入过于频繁" }, { status: 429, headers: CORS });

  const { slug, key } = await ctx.params;
  if (key.length > 64) return NextResponse.json({ error: "key 过长" }, { status: 400, headers: CORS });
  const project = publishedProject(slug);
  if (!project) return NextResponse.json({ error: "应用不存在" }, { status: 404, headers: CORS });

  const { v } = await req.json().catch(() => ({}));
  if (typeof v !== "string" || Buffer.byteLength(v, "utf8") > MAX_VALUE_BYTES) {
    return NextResponse.json({ error: `值必须是字符串且不超过 ${MAX_VALUE_BYTES / 1024}KB` }, { status: 400, headers: CORS });
  }
  const exists = db.prepare("SELECT 1 FROM app_kv WHERE project_id = ? AND k = ?").get(project.id, key);
  if (!exists) {
    const count = (db.prepare("SELECT COUNT(*) AS c FROM app_kv WHERE project_id = ?").get(project.id) as { c: number }).c;
    if (count >= MAX_KEYS_PER_APP) {
      return NextResponse.json({ error: `每个应用最多 ${MAX_KEYS_PER_APP} 个 key` }, { status: 400, headers: CORS });
    }
  }
  db.prepare(
    "INSERT INTO app_kv (project_id, k, v, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_id, k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at"
  ).run(project.id, key, v, now());
  return NextResponse.json({ ok: true }, { headers: CORS });
}
