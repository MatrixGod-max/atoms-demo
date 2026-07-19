import { describe, expect, it } from "vitest";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import { CLOUD_HOURLY_RATE, cloudRunner, settleCloudBilling } from "@/lib/cloud";
import { classifyReason } from "@/lib/credits";

function makePublished(credits = 20, slugPrefix = "cw"): { userId: string; projectId: string; slug: string } {
  const userId = newId("u");
  const projectId = newId("p");
  const versionId = newId("v");
  const slug = `${slugPrefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const t = now();
  db.prepare("INSERT INTO users (id, email, name, password_hash, credits, created_at) VALUES (?, ?, ?, 'x', ?, ?)").run(
    userId,
    `${userId}@test.dev`,
    "t",
    credits,
    t
  );
  db.prepare("INSERT INTO projects (id, user_id, name, slug, created_at, updated_at) VALUES (?, ?, 'cloud 测试', ?, ?, ?)").run(
    projectId,
    userId,
    slug,
    t,
    t
  );
  db.prepare("INSERT INTO app_versions (id, project_id, num, html, prompt, created_at) VALUES (?, ?, 1, '<html></html>', 'x', ?)").run(
    versionId,
    projectId,
    t
  );
  db.prepare("UPDATE projects SET current_version_id = ?, published_version_id = ? WHERE id = ?").run(versionId, versionId, projectId);
  db.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, created_at) VALUES (?, ?, ?, 1, ?)").run(
    newId("a"),
    projectId,
    versionId,
    t
  );
  return { userId, projectId, slug };
}

const balanceOf = (userId: string) =>
  (db.prepare("SELECT credits FROM users WHERE id = ?").get(userId) as { credits: number }).credits;

describe("Fusion Cloud(CLOUD_MOCK)", () => {
  it("rejects deploying an unpublished project", async () => {
    const userId = newId("u");
    const projectId = newId("p");
    db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, 't', 'x', ?)").run(userId, `${userId}@t.dev`, now());
    db.prepare("INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, 'x', ?, ?)").run(projectId, userId, now(), now());
    await expect(cloudRunner.deploy(projectId, userId, 2)).rejects.toMatchObject({ code: 400 });
  });

  it("deploy → running → stop → start lifecycle", async () => {
    const { userId, projectId } = makePublished();
    const inst = await cloudRunner.deploy(projectId, userId, 2);
    expect(inst.status).toBe("running");
    expect(inst.artifact_seq).toBe(1);
    expect(inst.last_billed_at).toBeGreaterThan(0);

    const stopped = cloudRunner.stop(projectId)!;
    expect(stopped.status).toBe("stopped");
    expect(stopped.last_billed_at).toBeNull();

    const started = cloudRunner.start(projectId)!;
    expect(started.status).toBe("running");
    expect(started.last_billed_at).toBeGreaterThan(0);
    await cloudRunner.remove(projectId);
  });

  it("failed deploy marks error and refunds", async () => {
    const { userId, projectId } = makePublished(20, "mockcloudfail");
    const before = balanceOf(userId);
    const inst = await cloudRunner.deploy(projectId, userId, 2);
    expect(inst.status).toBe("error");
    expect(balanceOf(userId)).toBe(before + 2); // runner 退款(路由层已扣的 2 分补回)
    const refund = db
      .prepare("SELECT delta FROM credit_events WHERE user_id = ? AND reason = 'refund:cloud-deploy'")
      .get(userId) as { delta: number };
    expect(refund.delta).toBe(2);
    await cloudRunner.remove(projectId);
  });

  it("settleCloudBilling charges whole hours and advances the billing cursor", async () => {
    const { userId, projectId, slug } = makePublished(20);
    await cloudRunner.deploy(projectId, userId, 2);
    const inst = cloudRunner.get(projectId)!;
    const backdated = now() - 3.5 * 3_600_000;
    db.prepare("UPDATE cloud_instances SET last_billed_at = ? WHERE id = ?").run(backdated, inst.id);

    const before = balanceOf(userId);
    const r = settleCloudBilling();
    expect(r.settled).toBeGreaterThanOrEqual(1);
    expect(balanceOf(userId)).toBe(before - 3 * CLOUD_HOURLY_RATE); // 3 个整小时
    const after = cloudRunner.get(projectId)!;
    expect(after.last_billed_at).toBe(backdated + 3 * 3_600_000); // 游标推进,余数保留
    const ev = db
      .prepare("SELECT delta FROM credit_events WHERE user_id = ? AND reason = ?")
      .get(userId, `cloud-hour:${slug}`) as { delta: number };
    expect(ev.delta).toBe(-3 * CLOUD_HOURLY_RATE);
    await cloudRunner.remove(projectId);
  });

  it("auto-stops the instance when the wallet runs dry", async () => {
    const { userId, projectId, slug } = makePublished(2); // 刚够部署,无余量付时租
    await cloudRunner.deploy(projectId, userId, 2);
    db.prepare("UPDATE users SET credits = 0 WHERE id = ?").run(userId);
    const inst = cloudRunner.get(projectId)!;
    db.prepare("UPDATE cloud_instances SET last_billed_at = ? WHERE id = ?").run(now() - 2 * 3_600_000, inst.id);

    const r = settleCloudBilling();
    expect(r.autostopped).toContain(slug);
    expect(cloudRunner.get(projectId)!.status).toBe("stopped");
    const marker = db
      .prepare("SELECT 1 FROM credit_events WHERE user_id = ? AND reason = ?")
      .get(userId, `cloud-autostop:${slug}`);
    expect(marker).toBeTruthy();
    expect(balanceOf(userId)).toBe(0); // 不足时不产生负余额
    await cloudRunner.remove(projectId);
  });
});

describe("AI 钱包归类", () => {
  it("classifies reasons into wallet categories", () => {
    expect(classifyReason("generate:fast")).toBe("生成");
    expect(classifyReason("goal-round:3")).toBe("生成");
    expect(classifyReason("native-build:android")).toBe("打包");
    expect(classifyReason("cloud-deploy")).toBe("云服务");
    expect(classifyReason("cloud-hour:abc")).toBe("云服务");
    expect(classifyReason("cloud-autostop:abc")).toBe("云服务");
    expect(classifyReason("redeem:FUSION-X")).toBe("充值奖励");
    expect(classifyReason("signup")).toBe("充值奖励");
    expect(classifyReason("plan:pro")).toBe("充值奖励");
    expect(classifyReason("refund:cloud-deploy")).toBe("退款");
    expect(classifyReason("whatever")).toBe("其他");
  });
});
