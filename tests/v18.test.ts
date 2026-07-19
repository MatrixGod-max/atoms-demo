import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import { appIdFor, nativeBuildRunner, sanitizeAppName } from "@/lib/nativeBuild";

function makeMobileProject(name = "打包测试"): { userId: string; projectId: string } {
  const userId = newId("u");
  const projectId = newId("p");
  const versionId = newId("v");
  const t = now();
  db.prepare("INSERT INTO users (id, email, name, password_hash, credits, created_at) VALUES (?, ?, ?, 'x', 20, ?)").run(
    userId,
    `${userId}@test.dev`,
    "t",
    t
  );
  db.prepare(
    "INSERT INTO projects (id, user_id, name, platform, created_at, updated_at) VALUES (?, ?, ?, 'mobile', ?, ?)"
  ).run(projectId, userId, name, t, t);
  db.prepare("INSERT INTO app_versions (id, project_id, num, html, prompt, created_at) VALUES (?, ?, 1, '<html></html>', 'x', ?)").run(
    versionId,
    projectId,
    t
  );
  db.prepare("UPDATE projects SET current_version_id = ? WHERE id = ?").run(versionId, projectId);
  return { userId, projectId };
}

async function waitBuild(buildId: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const b = nativeBuildRunner.get(buildId);
    if (b && (b.status === "done" || b.status === "error")) return b;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("build did not finish in time");
}

describe("原生打包(mock 构建机)", () => {
  it("sanitizes app identifiers for the remote shell", () => {
    expect(appIdFor("p_AbC-123xy")).toMatch(/^dev\.fusion\.a[a-z0-9]+$/);
    expect(sanitizeAppName("我的 App'\"; rm -rf /")).not.toMatch(/['\";]/);
    expect(sanitizeAppName("   ")).toBe("FusionApp");
  });

  it("runs a build to done with an APK artifact", async () => {
    const { userId, projectId } = makeMobileProject();
    const build = nativeBuildRunner.start(projectId, userId, "android", 5);
    expect(["queued", "building"]).toContain(build.status);
    const finished = await waitBuild(build.id);
    expect(finished.status).toBe("done");
    expect(finished.artifact_path && fs.existsSync(finished.artifact_path)).toBe(true);
    const head = fs.readFileSync(finished.artifact_path!).subarray(0, 2).toString();
    expect(head).toBe("PK");
    expect(finished.artifact_bytes).toBeGreaterThan(0);
  });

  it("rejects a concurrent build on the same project with 409", async () => {
    const { userId, projectId } = makeMobileProject();
    const first = nativeBuildRunner.start(projectId, userId, "android", 5);
    try {
      nativeBuildRunner.start(projectId, userId, "android", 5);
      expect.unreachable("second start should throw");
    } catch (err) {
      expect((err as Error & { code?: number }).code).toBe(409);
    }
    await waitBuild(first.id);
  });

  it("refunds the cost when the build fails", async () => {
    const { userId, projectId } = makeMobileProject("MOCK_NATIVE_FAIL 应用");
    const build = nativeBuildRunner.start(projectId, userId, "android", 5);
    const finished = await waitBuild(build.id);
    expect(finished.status).toBe("error");
    const refund = db
      .prepare("SELECT delta FROM credit_events WHERE user_id = ? AND reason = 'refund:native-build'")
      .get(userId) as { delta: number } | undefined;
    expect(refund?.delta).toBe(5);
  });
});
