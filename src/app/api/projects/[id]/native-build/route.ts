import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { nativeBuildRunner } from "@/lib/nativeBuild";
import { rateLimit } from "@/lib/ratelimit";
import { balance, charge } from "@/lib/credits";

export const dynamic = "force-dynamic";

export const NATIVE_BUILD_COST = 5;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!ownedProject(user.id, id)) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const builds = nativeBuildRunner.list(id).map((b) => ({
    id: b.id,
    platform: b.platform,
    status: b.status,
    error: b.error,
    artifact_bytes: b.artifact_bytes,
    log_tail: b.log ? b.log.slice(-1500) : null,
    created_at: b.created_at,
    updated_at: b.updated_at,
  }));
  return NextResponse.json({ builds });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (project.platform !== "mobile") {
    return NextResponse.json({ error: "原生打包仅支持移动应用项目" }, { status: 400 });
  }
  if (!project.current_version_id) {
    return NextResponse.json({ error: "还没有可打包的版本" }, { status: 400 });
  }
  const { platform } = await req.json().catch(() => ({}));
  if (platform !== "android" && platform !== "ios") {
    return NextResponse.json({ error: "platform 必须是 android 或 ios" }, { status: 400 });
  }
  const rl = rateLimit(`nbuild:${user.id}`, 3, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `打包过于频繁(每小时最多 3 次),请 ${rl.retryAfterSec} 秒后再试` }, { status: 429 });
  }
  if (!charge(user.id, NATIVE_BUILD_COST, `native-build:${platform}`)) {
    return NextResponse.json(
      { error: `积分不足(打包需 ${NATIVE_BUILD_COST},余额 ${balance(user.id)})` },
      { status: 402 }
    );
  }
  try {
    const build = nativeBuildRunner.start(id, user.id, platform, NATIVE_BUILD_COST);
    return NextResponse.json({ id: build.id, status: build.status, cost: NATIVE_BUILD_COST, credits: balance(user.id) });
  } catch (err) {
    // start() 抛出 = 什么都没入队,原路退款
    charge(user.id, -NATIVE_BUILD_COST, "refund:native-build-start");
    const e = err as Error & { code?: number };
    return NextResponse.json({ error: e.message }, { status: e.code === 409 ? 409 : e.code === 503 ? 503 : 500 });
  }
}
