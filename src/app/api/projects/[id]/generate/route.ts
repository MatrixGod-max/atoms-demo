import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { demoGuard, getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { jobRunner } from "@/lib/jobs";
import { rateLimit } from "@/lib/ratelimit";
import { normalizeMode } from "@/lib/models";

export const dynamic = "force-dynamic";

const DAILY_QUOTA = Number(process.env.DAILY_GENERATION_QUOTA || 30);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const blocked = demoGuard(user);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { prompt, research, team, mode } = await req.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "请输入需求" }, { status: 400 });
  }

  const rl = rateLimit(`gen:${user.id}`, 3, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `生成过于频繁(10 分钟内最多 3 次),请 ${rl.retryAfterSec} 秒后再试` },
      { status: 429 }
    );
  }
  const used = (
    db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE user_id = ? AND created_at > ?").get(user.id, now() - 24 * 3600 * 1000) as {
      c: number;
    }
  ).c;
  if (used >= DAILY_QUOTA) {
    return NextResponse.json({ error: `24 小时生成额度(${DAILY_QUOTA} 次)已用完,明天再来吧` }, { status: 429 });
  }

  try {
    const { jobId, position } = jobRunner.start(id, user.id, prompt.trim(), research === true, normalizeMode(mode), team === true);
    return NextResponse.json({ jobId, position });
  } catch (err) {
    const e = err as Error & { code?: number; jobId?: string };
    if (e.code === 409) {
      return NextResponse.json({ error: e.message, jobId: e.jobId }, { status: 409 });
    }
    throw err;
  }
}
