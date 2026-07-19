import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { balance, recentEvents } from "@/lib/credits";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ credits: balance(user.id), events: recentEvents(user.id) });
}
