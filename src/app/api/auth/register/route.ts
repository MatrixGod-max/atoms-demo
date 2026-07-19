import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { createSession, hashPassword, newId } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { SIGNUP_BONUS, recordEvent } from "@/lib/credits";

const USERNAME_RE = /^[a-zA-Z0-9_一-龥-]{2,20}$/;

export async function POST(req: Request) {
  const rl = rateLimit(`auth:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `尝试过于频繁,请 ${rl.retryAfterSec} 秒后再试` }, { status: 429 });
  }
  const { username, email, password, name } = await req.json().catch(() => ({}));

  const chosenUsername = typeof username === "string" && username.trim() ? username.trim() : null;
  const chosenEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
  if (!chosenUsername && !chosenEmail) {
    return NextResponse.json({ error: "用户名与邮箱至少填写一项" }, { status: 400 });
  }
  if (chosenUsername && !USERNAME_RE.test(chosenUsername)) {
    return NextResponse.json({ error: "用户名需为 2-20 位字母、数字、中文、下划线或中划线" }, { status: 400 });
  }
  if (chosenEmail && !/^\S+@\S+\.\S+$/.test(chosenEmail)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 10 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "密码至少 10 位,且需同时包含字母和数字" }, { status: 400 });
  }
  const displayName =
    typeof name === "string" && name.trim()
      ? name.trim().slice(0, 40)
      : (chosenUsername ?? chosenEmail!.split("@")[0]);

  if (chosenEmail && db.prepare("SELECT id FROM users WHERE email = ?").get(chosenEmail)) {
    return NextResponse.json({ error: "该邮箱已注册,请直接登录" }, { status: 409 });
  }
  if (chosenUsername && db.prepare("SELECT id FROM users WHERE lower(username) = lower(?)").get(chosenUsername)) {
    return NextResponse.json({ error: "该用户名已被占用,请换一个" }, { status: 409 });
  }
  const id = newId("u");
  db.prepare("INSERT INTO users (id, email, username, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    chosenEmail,
    chosenUsername,
    displayName,
    hashPassword(password),
    now()
  );
  recordEvent(id, SIGNUP_BONUS, "signup");
  await createSession(id);
  return NextResponse.json({ ok: true });
}
