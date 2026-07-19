import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { CLOUD_DEPLOY_COST, CLOUD_HOURLY_RATE, cloudRunner } from "@/lib/cloud";
import { balance, charge } from "@/lib/credits";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

function view(inst: ReturnType<typeof cloudRunner.get>) {
  if (!inst) return null;
  return {
    status: inst.status,
    slug: inst.slug,
    artifact_seq: inst.artifact_seq,
    hourly_rate: inst.hourly_rate,
    error: inst.error,
    log_tail: inst.log ? inst.log.slice(-1500) : null,
    deployed_at: inst.deployed_at,
    last_billed_at: inst.last_billed_at,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!ownedProject(user.id, id)) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({
    instance: view(cloudRunner.get(id)),
    pricing: { deploy: CLOUD_DEPLOY_COST, hourly: CLOUD_HOURLY_RATE },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { action } = await req.json().catch(() => ({}));
  if (action === "deploy") {
    const rl = rateLimit(`cloud:${user.id}`, 5, 60 * 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: `云部署过于频繁(每小时最多 5 次),请 ${rl.retryAfterSec} 秒后再试` }, { status: 429 });
    }
    if (!charge(user.id, CLOUD_DEPLOY_COST, "cloud-deploy")) {
      return NextResponse.json(
        { error: `积分不足(部署需 ${CLOUD_DEPLOY_COST},余额 ${balance(user.id)})` },
        { status: 402 }
      );
    }
    try {
      const inst = await cloudRunner.deploy(id, user.id, CLOUD_DEPLOY_COST);
      return NextResponse.json({ instance: view(inst), credits: balance(user.id) });
    } catch (err) {
      // deploy() 抛出 = 未开始(前置校验/通道忙),原路退款
      charge(user.id, -CLOUD_DEPLOY_COST, "refund:cloud-deploy-start");
      const e = err as Error & { code?: number };
      return NextResponse.json({ error: e.message }, { status: e.code ?? 500 });
    }
  }
  if (action === "stop") {
    return NextResponse.json({ instance: view(cloudRunner.stop(id)) });
  }
  if (action === "start") {
    return NextResponse.json({ instance: view(cloudRunner.start(id)) });
  }
  if (action === "delete") {
    await cloudRunner.remove(id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "action 必须是 deploy|start|stop|delete" }, { status: 400 });
}
