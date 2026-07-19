import { beforeAll, describe, expect, it } from "vitest";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import { jobRunner } from "@/lib/jobs";

function makeProject(): { userId: string; projectId: string } {
  const userId = newId("u");
  const projectId = newId("p");
  const t = now();
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, 'x', ?)").run(
    userId,
    `${userId}@test.dev`,
    "t",
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

async function waitForTerminal(jobId: string, timeoutMs = 45_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = jobRunner.getJob(jobId);
    if (job && (job.status === "done" || job.status === "error")) return job.status;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("job did not finish in time");
}

describe("job runner (mock pipeline)", () => {
  beforeAll(() => {
    db.exec("DELETE FROM jobs");
  });

  it("runs a job to completion and persists a version", async () => {
    const { userId, projectId } = makeProject();
    const { jobId } = jobRunner.start(projectId, userId, "mock 应用");
    expect(await waitForTerminal(jobId)).toBe("done");
    const versions = db.prepare("SELECT * FROM app_versions WHERE project_id = ?").all(projectId);
    expect(versions.length).toBe(1);
    const project = db.prepare("SELECT current_version_id FROM projects WHERE id = ?").get(projectId) as {
      current_version_id: string | null;
    };
    expect(project.current_version_id).toBeTruthy();
  });

  it("rejects a second concurrent job on the same project with code 409", async () => {
    const { userId, projectId } = makeProject();
    const { jobId } = jobRunner.start(projectId, userId, "first");
    try {
      jobRunner.start(projectId, userId, "second");
      expect.unreachable("second start should throw");
    } catch (err) {
      expect((err as Error & { code?: number }).code).toBe(409);
    }
    await waitForTerminal(jobId);
  });

  it("replays buffered events to a late subscriber", async () => {
    const { userId, projectId } = makeProject();
    const { jobId } = jobRunner.start(projectId, userId, "mock 应用");
    await waitForTerminal(jobId);
    const sub = jobRunner.subscribe(jobId, () => {});
    const types = sub.replay.map((p) => JSON.parse(p).type);
    expect(types).toContain("plan");
    expect(types).toContain("code_delta");
    expect(types).toContain("version");
    expect(sub.done).toBe(true);
    sub.detach();
  });
});
