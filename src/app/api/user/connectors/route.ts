import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CONNECTORS, SLACK_WEBHOOK_RE, maskSecret } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const rows = db
    .prepare("SELECT connector, secret, updated_at FROM connector_credentials WHERE user_id = ?")
    .all(user.id) as { connector: string; secret: string; updated_at: number }[];
  return NextResponse.json({
    credentials: rows.map((r) => ({ connector: r.connector, masked: maskSecret(r.secret), updatedAt: r.updated_at })),
  });
}

export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { connector, secret } = await req.json().catch(() => ({}));
  const info = CONNECTORS.find((c) => c.id === connector && c.kind === "token");
  if (!info) return NextResponse.json({ error: "未知连接器" }, { status: 400 });
  if (typeof secret !== "string" || secret.trim().length < 8 || secret.trim().length > 500) {
    return NextResponse.json({ error: "令牌格式无效(8-500 字符)" }, { status: 400 });
  }
  const value = secret.trim();
  if (connector === "slack" && !SLACK_WEBHOOK_RE.test(value)) {
    return NextResponse.json({ error: "Slack Webhook 地址必须以 https://hooks.slack.com/ 开头" }, { status: 400 });
  }
  const t = now();
  db.prepare(
    `INSERT INTO connector_credentials (user_id, connector, secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, connector) DO UPDATE SET secret = excluded.secret, updated_at = excluded.updated_at`
  ).run(user.id, connector, value, t, t);
  return NextResponse.json({ ok: true, masked: maskSecret(value) });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { connector } = await req.json().catch(() => ({}));
  if (typeof connector !== "string") return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  db.prepare("DELETE FROM connector_credentials WHERE user_id = ? AND connector = ?").run(user.id, connector);
  return NextResponse.json({ ok: true });
}
