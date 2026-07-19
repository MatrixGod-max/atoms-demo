import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { createSession, hashPassword, newId } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const rl = rateLimit(`auth:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `尝试过于频繁,请 ${rl.retryAfterSec} 秒后再试` }, { status: 429 });
  }
  const { email, password, name } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 10 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "密码至少 10 位,且需同时包含字母和数字" }, { status: 400 });
  }
  const displayName = typeof name === "string" && name.trim() ? name.trim().slice(0, 40) : email.split("@")[0];

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (exists) {
    return NextResponse.json({ error: "该邮箱已注册,请直接登录" }, { status: 409 });
  }
  const id = newId("u");
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    email.toLowerCase(),
    displayName,
    hashPassword(password),
    now()
  );
  await createSession(id);
  return NextResponse.json({ ok: true });
}
