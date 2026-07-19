import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { canStartJob, jobRunner } from "@/lib/jobs";
import { rateLimit } from "@/lib/ratelimit";
import { normalizeMode } from "@/lib/models";
import { PLAN_GEN_PER_10MIN, balance, charge, generationCost } from "@/lib/credits";

export const dynamic = "force-dynamic";

const DAILY_QUOTA = Number(process.env.DAILY_GENERATION_QUOTA || 30);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { prompt, research, team, mode, target, goalLoop } = await req.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "请输入需求" }, { status: 400 });
  }
  if (goalLoop === true && !project.goal) {
    return NextResponse.json({ error: "请先为项目设置目标" }, { status: 400 });
  }
  const pickTarget =
    target && typeof target.selector === "string" && target.selector.trim()
      ? {
          selector: target.selector.trim().slice(0, 300),
          snippet: typeof target.snippet === "string" ? target.snippet.slice(0, 1000) : "",
        }
      : null;

  // Per-plan concurrency gate first: a rejected attempt must not burn a
  // rate-limit slot (rateLimit records on every call) nor touch credits.
  const can = canStartJob(user.id, user.plan);
  if (!can.ok) return NextResponse.json({ error: can.error }, { status: 429 });

  const genLimit = PLAN_GEN_PER_10MIN[user.plan] ?? 3;
  const rl = rateLimit(`gen:${user.id}`, genLimit, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `生成过于频繁(10 分钟内最多 ${genLimit} 次),请 ${rl.retryAfterSec} 秒后再试` },
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

  // 聚变首次生成走双源合并流水线,收 +2 附加费。
  const isFusion = !!project.fused_from && !project.current_version_id;
  const cost = generationCost(normalizeMode(mode), research === true, team === true, isFusion, project.engine === "project");
  if (!charge(user.id, cost, `generate:${normalizeMode(mode)}`)) {
    return NextResponse.json(
      { error: `积分不足(本次需 ${cost},余额 ${balance(user.id)})。点击顶部横幅领取免费积分。` },
      { status: 402 }
    );
  }
  try {
    const { jobId, position } = jobRunner.start(id, user.id, prompt.trim(), research === true, normalizeMode(mode), team === true, cost, pickTarget);
    if (goalLoop === true) {
      // Arm only after a successful start; a 409/throw leaves the flag untouched.
      db.prepare("UPDATE projects SET goal_active = 1, goal_round = 0, goal_status = 'running' WHERE id = ?").run(id);
    }
    return NextResponse.json({ jobId, position, cost, credits: balance(user.id) });
  } catch (err) {
    const e = err as Error & { code?: number; jobId?: string };
    // start() failed -> nothing will run; give the credits back.
    charge(user.id, -cost, "refund:start-failed");
    if (e.code === 409) {
      return NextResponse.json({ error: e.message, jobId: e.jobId }, { status: 409 });
    }
    throw err;
  }
}
