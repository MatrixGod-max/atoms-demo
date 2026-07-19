import { describe, expect, it } from "vitest";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import { jobRunner } from "@/lib/jobs";
import { generationCost } from "@/lib/credits";
import { runAcceptance } from "@/lib/validate";
import { POST as reportPost } from "@/app/api/apps/[slug]/report/route";

function makeUser(): string {
  const userId = newId("u");
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, 'x', ?)").run(
    userId,
    `${userId}@test.dev`,
    "t",
    now()
  );
  return userId;
}

function makeProject(userId: string): string {
  const projectId = newId("p");
  db.prepare("INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, 'test', ?, ?)").run(
    projectId,
    userId,
    now(),
    now()
  );
  return projectId;
}

/** A published source app for fusion/report tests. */
function makePublished(userId: string, name: string, slug: string): string {
  const projectId = makeProject(userId);
  const versionId = newId("v");
  db.prepare(
    "INSERT INTO app_versions (id, project_id, num, html, prompt, created_at) VALUES (?, ?, 1, ?, 'seed', ?)"
  ).run(versionId, projectId, `<!DOCTYPE html><html><head><title>${name}</title></head><body>${name}</body></html>`, now());
  db.prepare(
    "UPDATE projects SET name = ?, slug = ?, current_version_id = ?, published_version_id = ? WHERE id = ?"
  ).run(name, slug, versionId, versionId, projectId);
  return projectId;
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

function versionHtml(projectId: string): string {
  const row = db
    .prepare("SELECT html FROM app_versions WHERE project_id = ? ORDER BY num DESC LIMIT 1")
    .get(projectId) as { html: string } | undefined;
  return row?.html ?? "";
}

describe("指哪改哪: picked element flows into the pipeline", () => {
  it("marks the produced version with the picked selector", async () => {
    const userId = makeUser();
    const projectId = makeProject(userId);
    const { jobId } = jobRunner.start(projectId, userId, "改按钮", false, "fast", false, 0, {
      selector: "#btn",
      snippet: '<button id="btn">Go</button>',
    });
    expect(await waitForTerminal(jobId)).toBe("done");
    expect(versionHtml(projectId)).toContain("<!-- target: #btn -->");
  });
});

describe("聚变: two published apps merge into a new one", () => {
  it("runs the fusion pipeline and persists plan + version", async () => {
    const userId = makeUser();
    const slugA = `fa${Date.now()}`;
    const slugB = `fb${Date.now()}`;
    makePublished(userId, "计数器", slugA);
    makePublished(userId, "看板", slugB);

    const fusedId = makeProject(userId);
    db.prepare("UPDATE projects SET fused_from = ? WHERE id = ?").run(
      JSON.stringify([
        { slug: slugA, name: "计数器" },
        { slug: slugB, name: "看板" },
      ]),
      fusedId
    );
    const { jobId } = jobRunner.start(fusedId, userId, "聚变合成两个应用");
    expect(await waitForTerminal(jobId)).toBe("done");

    expect(versionHtml(fusedId)).toContain("<!-- fused: 计数器+看板 -->");
    const fusionMsg = db
      .prepare("SELECT content FROM messages WHERE project_id = ? AND meta = 'fusion'")
      .get(fusedId) as { content: string } | undefined;
    expect(fusionMsg).toBeTruthy();
    expect(JSON.parse(fusionMsg!.content).name).toBe("Mock 聚变应用");
    // The fusion plan names the project, Planner-style.
    const project = db.prepare("SELECT name FROM projects WHERE id = ?").get(fusedId) as { name: string };
    expect(project.name).toBe("Mock 聚变应用");
  });

  it("prices the fusion surcharge", () => {
    expect(generationCost("fast", false, false, true)).toBe(3);
    expect(generationCost("deep", true, true, true)).toBe(9);
    expect(generationCost("fast", false, false)).toBe(1);
  });
});

describe("验收驱动验证", () => {
  it("persists PM acceptance criteria on team builds and reports results", async () => {
    const userId = makeUser();
    const projectId = makeProject(userId);
    const { jobId } = jobRunner.start(projectId, userId, "做一个计数器", false, "fast", true);
    expect(await waitForTerminal(jobId)).toBe("done");
    const row = db.prepare("SELECT acceptance FROM projects WHERE id = ?").get(projectId) as { acceptance: string | null };
    expect(JSON.parse(row.acceptance ?? "[]")).toEqual(["点击后数字+1"]);
    // With Chrome available the acceptance run is recorded; without it the validator honestly skips.
    const acceptanceMsg = db.prepare("SELECT content FROM messages WHERE project_id = ? AND meta = 'acceptance'").get(projectId) as
      | { content: string }
      | undefined;
    const version = db
      .prepare("SELECT review_notes FROM app_versions WHERE project_id = ? ORDER BY num DESC LIMIT 1")
      .get(projectId) as { review_notes: string | null };
    if (acceptanceMsg) {
      const results = JSON.parse(acceptanceMsg.content) as { criterion: string; pass: boolean }[];
      expect(results[0].criterion).toBe("点击后数字+1");
      expect(results[0].pass).toBe(true);
      expect(version.review_notes).toContain("验收 1/1 通过");
    } else {
      expect(version.review_notes).toContain("验收环境不可用");
    }
  }, 60_000);

  it("DSL executor passes and fails deterministically", async () => {
    const html = `<!DOCTYPE html><html><head></head><body><h1 id="n">0</h1><button id="b" onclick="document.getElementById('n').textContent='1'">+1</button></body></html>`;
    const res = await runAcceptance(html, "web", [
      {
        criterion: "点击后变为1",
        steps: [
          { action: "click", selector: "#b" },
          { action: "assertText", selector: "#n", contains: "1" },
        ],
      },
      { criterion: "不存在的元素", steps: [{ action: "click", selector: "#nope" }] },
      { criterion: "纯视觉标准", steps: [] },
    ]);
    if (res.skipped) return; // no Chrome in this environment — executor honestly skips
    expect(res.results[0].pass).toBe(true);
    expect(res.results[1].pass).toBe(false);
    expect(res.results[1].note).toContain("#nope");
    expect(res.results[2].skipped).toBe(true);
  }, 60_000);
});

describe("反馈闭环: visitor report endpoint", () => {
  function post(slug: string, body: unknown, ip = "9.9.9.9") {
    return reportPost(
      new Request(`http://test/api/apps/${slug}/report`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ slug }) }
    );
  }

  it("stores feedback, dedupes repeated errors, rejects junk", async () => {
    const userId = makeUser();
    const slug = `rp${Date.now()}`;
    const projectId = makePublished(userId, "报告应用", slug);

    expect((await post(slug, { kind: "feedback", content: "希望支持深色模式" }, "1.1.1.1")).status).toBe(200);
    expect((await post(slug, { kind: "error", content: "TypeError: x is null" }, "1.1.1.2")).status).toBe(200);
    const dup = await (await post(slug, { kind: "error", content: "TypeError: x is null" }, "1.1.1.3")).json();
    expect(dup.deduped).toBe(true);

    expect((await post(slug, { kind: "nope", content: "x" }, "1.1.1.4")).status).toBe(400);
    expect((await post(slug, { kind: "feedback", content: "" }, "1.1.1.5")).status).toBe(400);
    expect((await post("no-such-slug", { kind: "feedback", content: "x" }, "1.1.1.6")).status).toBe(404);

    const rows = db
      .prepare("SELECT kind, content, status FROM app_reports WHERE project_id = ? ORDER BY created_at")
      .all(projectId) as { kind: string; content: string; status: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "feedback", content: "希望支持深色模式", status: "new" });
    expect(rows[1]).toMatchObject({ kind: "error", status: "new" });
  });

  it("rate limits per ip+slug", async () => {
    const userId = makeUser();
    const slug = `rl${Date.now()}`;
    makePublished(userId, "限流应用", slug);
    let last = 200;
    for (let i = 0; i < 7; i++) {
      last = (await post(slug, { kind: "feedback", content: `f${i}` }, "2.2.2.2")).status;
    }
    expect(last).toBe(429);
  });
});
