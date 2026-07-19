import { NextResponse } from "next/server";
import { demoGuard, getUser } from "@/lib/auth";
import { PLANS, type Plan, balance, switchPlan } from "@/lib/credits";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const refusal = demoGuard(user);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });

  const { plan } = await req.json().catch(() => ({}));
  if (typeof plan !== "string" || !PLANS.includes(plan as Plan)) {
    return NextResponse.json({ error: "无效的套餐" }, { status: 400 });
  }
  const res = switchPlan(user.id, plan as Plan);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, plan, bonus: res.bonus, credits: balance(user.id) });
}
