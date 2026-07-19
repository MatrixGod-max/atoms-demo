import { describe, expect, it } from "vitest";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import { jobRunner } from "@/lib/jobs";
import { runGoalEval } from "@/lib/agent";

function makeProject(credits = 10): { userId: string; projectId: string } {
  const userId = newId("u");
  const projectId = newId("p");
  const t = now();
  db.prepare("INSERT INTO users (id, email, name, password_hash, credits, created_at) VALUES (?, ?, ?, 'x', ?, ?)").run(
    userId,
    `${userId}@test.dev`,
    "t",
    credits,
    t
  );
  db.prepare("INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, 'test', ?, ?)").run(
    projectId,
    userId,
    t,
    t
  );
  return { userId, projectId };
}

function armGoal(projectId: string, goal: string, rounds = 5) {
  db.prepare(
    "UPDATE projects SET goal = ?, goal_rounds = ?, goal_active = 1, goal_round = 0, goal_status = 'running' WHERE id = ?"
  ).run(goal, rounds, projectId);
}

function projectGoal(projectId: string) {
  return db.prepare("SELECT goal_active, goal_round, goal_status FROM projects WHERE id = ?").get(projectId) as {
    goal_active: number;
    goal_round: number;
    goal_status: string | null;
  };
}

async function waitForGoalEnd(projectId: string, timeoutMs = 55_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const g = projectGoal(projectId);
    if (!g.goal_active && !jobRunner.activeJobForProject(projectId)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("goal loop did not finish in time");
}

describe("goal mode (mock pipeline)", () => {
  it("mock evaluator is deterministic", async () => {
    const notMet = await runGoalEval({ goal: "x", html: "<html>", round: 1, maxRounds: 5 });
    expect(notMet.met).toBe(false);
    expect(notMet.gaps.length).toBeGreaterThan(0);
    expect(notMet.next_request).toBeTruthy();
    const met = await runGoalEval({ goal: "x", html: "<html>", round: 2, maxRounds: 5 });
    expect(met.met).toBe(true);
    const never = await runGoalEval({ goal: "MOCK_NEVER_MET", html: "<html>", round: 9, maxRounds: 9 });
    expect(never.met).toBe(false);
  });

  it("chains rounds and stops when the evaluator says met", async () => {
    const { userId, projectId } = makeProject(10);
    armGoal(projectId, "做一个计数器", 5);
    const { jobId } = jobRunner.start(projectId, userId, "做一个计数器");
    await waitForGoalEnd(projectId);

    // Round-1 stream must carry the eval verdict and the chained job pointer for the client to follow.
    const sub = jobRunner.subscribe(jobId, () => {});
    const types = sub.replay.map((p) => JSON.parse(p).type);
    sub.detach();
    expect(types).toContain("goal_eval");
    expect(types).toContain("goal_next");
    expect(types.indexOf("goal_next")).toBeLessThan(types.lastIndexOf("job_state"));

    const g = projectGoal(projectId);
    expect(g.goal_status).toBe("met");
    expect(g.goal_round).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS c FROM app_versions WHERE project_id = ?").get(projectId)).toMatchObject({ c: 2 });
    const evals = db.prepare("SELECT content FROM messages WHERE project_id = ? AND meta = 'goal_eval'").all(projectId);
    expect(evals.length).toBe(2);
    const autos = db.prepare("SELECT * FROM messages WHERE project_id = ? AND meta = 'goal_auto'").all(projectId);
    expect(autos.length).toBe(1);
    const chargeRow = db
      .prepare("SELECT delta FROM credit_events WHERE user_id = ? AND reason = 'goal-round:2'")
      .get(userId) as { delta: number } | undefined;
    expect(chargeRow?.delta).toBe(-1);
    const doneMsg = db
      .prepare("SELECT content FROM messages WHERE project_id = ? AND content LIKE '%目标已达成%'")
      .get(projectId);
    expect(doneMsg).toBeTruthy();
  });

  it("stops at the round cap when the goal is never met", async () => {
    const { userId, projectId } = makeProject(10);
    armGoal(projectId, "MOCK_NEVER_MET 的目标", 2);
    jobRunner.start(projectId, userId, "开始");
    await waitForGoalEnd(projectId);

    const g = projectGoal(projectId);
    expect(g.goal_status).toBe("cap");
    expect(g.goal_round).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS c FROM app_versions WHERE project_id = ?").get(projectId)).toMatchObject({ c: 2 });
    const capMsg = db.prepare("SELECT content FROM messages WHERE project_id = ? AND content LIKE '%轮次上限%'").get(projectId);
    expect(capMsg).toBeTruthy();
  });

  it("stops gracefully when credits run out", async () => {
    const { userId, projectId } = makeProject(0);
    armGoal(projectId, "MOCK_NEVER_MET 的目标", 5);
    jobRunner.start(projectId, userId, "开始");
    await waitForGoalEnd(projectId);

    const g = projectGoal(projectId);
    expect(g.goal_status).toBe("no_credits");
    expect(db.prepare("SELECT COUNT(*) AS c FROM app_versions WHERE project_id = ?").get(projectId)).toMatchObject({ c: 1 });
    const msg = db.prepare("SELECT content FROM messages WHERE project_id = ? AND content LIKE '%积分不足%'").get(projectId);
    expect(msg).toBeTruthy();
    const bal = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId) as { credits: number };
    expect(bal.credits).toBeGreaterThanOrEqual(0);
  });

  it("honors an external stop at the round boundary", async () => {
    const { userId, projectId } = makeProject(10);
    armGoal(projectId, "MOCK_NEVER_MET 的目标", 5);
    jobRunner.start(projectId, userId, "开始");
    db.prepare("UPDATE projects SET goal_active = 0 WHERE id = ?").run(projectId);
    await waitForGoalEnd(projectId);

    const g = projectGoal(projectId);
    expect(g.goal_status).toBe("stopped");
    expect(db.prepare("SELECT COUNT(*) AS c FROM app_versions WHERE project_id = ?").get(projectId)).toMatchObject({ c: 1 });
  });

  it("leaves goal-less projects untouched", async () => {
    const { userId, projectId } = makeProject(10);
    const { jobId } = jobRunner.start(projectId, userId, "普通生成");
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const job = jobRunner.getJob(jobId);
      if (job && (job.status === "done" || job.status === "error")) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(jobRunner.getJob(jobId)?.status).toBe("done");
    expect(db.prepare("SELECT COUNT(*) AS c FROM app_versions WHERE project_id = ?").get(projectId)).toMatchObject({ c: 1 });
    const g = projectGoal(projectId);
    expect(g.goal_active).toBe(0);
    expect(g.goal_status).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS c FROM messages WHERE project_id = ? AND meta = 'goal_eval'").get(projectId)).toMatchObject({ c: 0 });
  });
});
