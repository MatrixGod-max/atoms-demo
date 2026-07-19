import { NextResponse } from "next/server";
import { demoGuard, getUser } from "@/lib/auth";
import { balance, redeemCode } from "@/lib/credits";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const refusal = demoGuard(user);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });

  const rl = rateLimit(`redeem:${user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `尝试过于频繁,请 ${rl.retryAfterSec} 秒后再试` }, { status: 429 });
  }
  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code.trim() || code.length > 64) {
    return NextResponse.json({ error: "请输入兑换码" }, { status: 400 });
  }
  const res = redeemCode(user.id, code);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, amount: res.amount, credits: balance(user.id) });
}
