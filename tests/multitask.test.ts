import { describe, expect, it } from "vitest";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import { canStartJob, jobRunner } from "@/lib/jobs";

function makeUser(plan = "free"): string {
  const id = newId("u");
  db.prepare("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, 't', 'x', ?, ?)").run(
    id,
    `${id}@test.dev`,
    plan,
    now()
  );
  return id;
}

function makeProject(userId: string, name = "多任务测试"): string {
  const id = newId("p");
  db.prepare("INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    userId,
    name,
    now(),
    now()
  );
  return id;
}

async function waitForTerminal(jobId: string, timeoutMs = 50_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = jobRunner.getJob(jobId);
    if (job && (job.status === "done" || job.status === "error")) return job.status;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("job did not finish in time");
}

describe("multi-task", () => {
  it("activeJobsForUser lists cross-project jobs with names and hides other users", async () => {
    const u = makeUser("pro");
    const other = makeUser();
    const pa = makeProject(u, "项目甲");
    const pb = makeProject(u, "项目乙");
    const po = makeProject(other, "别人的");
    const ja = jobRunner.start(pa, u, "构建甲");
    const jb = jobRunner.start(pb, u, "构建乙");
    const jo = jobRunner.start(po, other, "别人的任务");

    const mine = jobRunner.activeJobsForUser(u);
    expect(mine.map((j) => j.project_name).sort()).toEqual(["项目乙", "项目甲"]);
    expect(mine.every((j) => j.status === "queued" || j.status === "running")).toBe(true);
    expect(jobRunner.activeJobsForUser(other).length).toBe(1);

    await Promise.all([waitForTerminal(ja.jobId), waitForTerminal(jb.jobId), waitForTerminal(jo.jobId)]);
    expect(jobRunner.activeJobsForUser(u)).toEqual([]);
  });

  it("global cap runs 3 and queues the 4th with a correct position, FIFO drains", async () => {
    const started = [1, 2, 3, 4].map((i) => {
      const u = makeUser("max");
      const p = makeProject(u, `并发${i}`);
      return jobRunner.start(p, u, `构建 ${i}`);
    });

    const running = (
      db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE status = 'running'").get() as { c: number }
    ).c;
    expect(running).toBe(3);
    expect(started[3].position).toBe(3);
    expect(jobRunner.queuePosition(started[3].jobId)).toBe(3);
    expect(jobRunner.queuePosition(started[0].jobId)).toBe(0);

    for (const s of started) expect(await waitForTerminal(s.jobId)).toBe("done");
  });

  it("canStartJob enforces per-plan concurrency with clear copy", async () => {
    const u = makeUser("free");
    const p = makeProject(u);
    const { jobId } = jobRunner.start(p, u, "占位任务");

    const free = canStartJob(u, "free");
    expect(free.ok).toBe(false);
    if (!free.ok) {
      expect(free.limit).toBe(1);
      expect(free.error).toContain("同时构建数已达 1");
      expect(free.error).toContain("免费版");
    }
    expect(canStartJob(u, "pro").ok).toBe(true);
    expect(canStartJob(u, "max").ok).toBe(true);

    await waitForTerminal(jobId);
    expect(canStartJob(u, "free").ok).toBe(true);
  });
});
