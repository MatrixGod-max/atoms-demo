import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const rl = rateLimit(`auth:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `尝试过于频繁,请 ${rl.retryAfterSec} 秒后再试` }, { status: 429 });
  }
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
  }
  const row = db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email.toLowerCase()) as
    | { id: string; password_hash: string }
    | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }
  await createSession(row.id);
  return NextResponse.json({ ok: true });
}
