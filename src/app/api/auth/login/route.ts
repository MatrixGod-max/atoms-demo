import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const rl = rateLimit(`auth:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `尝试过于频繁,请 ${rl.retryAfterSec} 秒后再试` }, { status: 429 });
  }
  const { account, email, password } = await req.json().catch(() => ({}));
  // Older clients send {email}; the unified field accepts a username or an email.
  const ident =
    typeof account === "string" && account.trim() ? account.trim() : typeof email === "string" ? email.trim() : "";
  if (!ident || typeof password !== "string") {
    return NextResponse.json({ error: "请输入账号和密码" }, { status: 400 });
  }
  const row = (
    ident.includes("@")
      ? db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(ident.toLowerCase())
      : db.prepare("SELECT id, password_hash FROM users WHERE lower(username) = lower(?)").get(ident)
  ) as { id: string; password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  }
  await createSession(row.id);
  return NextResponse.json({ ok: true });
}
