import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { balance, classifyReason } from "@/lib/credits";
import { cloudRunner } from "@/lib/cloud";

export const dynamic = "force-dynamic";

/** AI 钱包总览:余额 / 分类汇总 / 流水(游标分页)/ 运行中云实例与可续航时长。 */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const before = Number(new URL(req.url).searchParams.get("before")) || Date.now() + 1;
  const events = (
    db
      .prepare("SELECT delta, reason, created_at FROM credit_events WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT 50")
      .all(user.id, before) as { delta: number; reason: string; created_at: number }[]
  ).map((e) => ({ ...e, category: classifyReason(e.reason) }));

  const all = db
    .prepare("SELECT delta, reason FROM credit_events WHERE user_id = ?")
    .all(user.id) as { delta: number; reason: string }[];
  const summary: Record<string, { spent: number; earned: number }> = {};
  for (const e of all) {
    const cat = classifyReason(e.reason);
    summary[cat] ??= { spent: 0, earned: 0 };
    if (e.delta < 0) summary[cat].spent += -e.delta;
    else summary[cat].earned += e.delta;
  }

  const instances = cloudRunner.listRunning(user.id).map((i) => ({
    project_id: i.project_id,
    slug: i.slug,
    hourly_rate: i.hourly_rate,
    deployed_at: i.deployed_at,
  }));
  const hourlyTotal = instances.reduce((s, i) => s + i.hourly_rate, 0);
  const bal = balance(user.id);

  return NextResponse.json({
    balance: bal,
    summary,
    events,
    cloud: {
      instances,
      hourlyTotal,
      // 余额 ÷ 总时率 = 可续航小时(无运行实例时为 null)
      runwayHours: hourlyTotal > 0 ? Math.floor(bal / hourlyTotal) : null,
    },
  });
}
