import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoGuard, getUser, hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const refusal = demoGuard(user);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });

  const { name, currentPassword, newPassword } = await req.json().catch(() => ({}));

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim().slice(0, 40), user.id);
  }

  if (currentPassword !== undefined || newPassword !== undefined) {
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ error: "请填写当前密码和新密码" }, { status: 400 });
    }
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string };
    if (!verifyPassword(currentPassword, row.password_hash)) {
      return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
    }
    if (newPassword.length < 10 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: "密码至少 10 位,且需同时包含字母和数字" }, { status: 400 });
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), user.id);
  }

  return NextResponse.json({ ok: true });
}
