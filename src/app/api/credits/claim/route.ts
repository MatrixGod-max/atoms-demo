import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { BANNER_BONUS, balance, hasClaimed, recordEvent } from "@/lib/credits";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (hasClaimed(user.id, "banner")) {
    return NextResponse.json({ ok: true, claimed: false, credits: balance(user.id), message: "已领取过啦" });
  }
  recordEvent(user.id, BANNER_BONUS, "banner");
  return NextResponse.json({ ok: true, claimed: true, credits: balance(user.id) });
}
