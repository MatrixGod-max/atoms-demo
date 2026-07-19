import { describe, expect, it } from "vitest";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";

/**
 * Artifact registry semantics at the data layer (the API route is a thin wrapper
 * over these same statements; the HTTP path is covered by scripts/smoke.sh).
 */

function seed(): { projectId: string; v1: string; v2: string } {
  const userId = newId("u");
  const projectId = newId("p");
  const t = now();
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, 'a', 'x', ?)").run(
    userId,
    `${userId}@t.dev`,
    t
  );
  db.prepare("INSERT INTO projects (id, user_id, name, slug, created_at, updated_at) VALUES (?, ?, 'app', ?, ?, ?)").run(
    projectId,
    userId,
    `slg${Math.random().toString(36).slice(2, 8)}`,
    t,
    t
  );
  const v1 = newId("v");
  const v2 = newId("v");
  for (const [vid, num] of [
    [v1, 1],
    [v2, 2],
  ] as const) {
    db.prepare(
      "INSERT INTO app_versions (id, project_id, num, html, prompt, created_at) VALUES (?, ?, ?, '<!DOCTYPE html>x', 'p', ?)"
    ).run(vid, projectId, num, t);
  }
  return { projectId, v1, v2 };
}

function publishArtifact(projectId: string, versionId: string): number {
  const existing = db
    .prepare("SELECT seq FROM artifacts WHERE project_id = ? AND version_id = ?")
    .get(projectId, versionId) as { seq: number } | undefined;
  let seq: number;
  if (existing) {
    seq = existing.seq;
  } else {
    seq =
      ((db.prepare("SELECT MAX(seq) AS m FROM artifacts WHERE project_id = ?").get(projectId) as { m: number | null })
        .m ?? 0) + 1;
    db.prepare(
      "INSERT INTO artifacts (id, project_id, version_id, seq, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(newId("a"), projectId, versionId, seq, now());
  }
  db.prepare("UPDATE projects SET published_version_id = ? WHERE id = ?").run(versionId, projectId);
  return seq;
}

describe("artifact registry", () => {
  it("increments seq per publish and keeps snapshots immutable", () => {
    const { projectId, v1, v2 } = seed();
    expect(publishArtifact(projectId, v1)).toBe(1);
    expect(publishArtifact(projectId, v2)).toBe(2);
    const rows = db.prepare("SELECT seq, version_id FROM artifacts WHERE project_id = ? ORDER BY seq").all(projectId) as {
      seq: number;
      version_id: string;
    }[];
    expect(rows.map((r) => r.version_id)).toEqual([v1, v2]);
  });

  it("re-publishing the same version is a no-op (same seq, no new artifact)", () => {
    const { projectId, v1 } = seed();
    expect(publishArtifact(projectId, v1)).toBe(1);
    expect(publishArtifact(projectId, v1)).toBe(1);
    const count = (db.prepare("SELECT COUNT(*) AS c FROM artifacts WHERE project_id = ?").get(projectId) as { c: number })
      .c;
    expect(count).toBe(1);
  });

  it("set_latest moves the pointer without creating a new seq", () => {
    const { projectId, v1, v2 } = seed();
    publishArtifact(projectId, v1);
    publishArtifact(projectId, v2);
    db.prepare(
      "UPDATE projects SET published_version_id = (SELECT version_id FROM artifacts WHERE project_id = ? AND seq = 1) WHERE id = ?"
    ).run(projectId, projectId);
    const p = db.prepare("SELECT published_version_id FROM projects WHERE id = ?").get(projectId) as {
      published_version_id: string;
    };
    expect(p.published_version_id).toBe(v1);
    const count = (db.prepare("SELECT COUNT(*) AS c FROM artifacts WHERE project_id = ?").get(projectId) as { c: number })
      .c;
    expect(count).toBe(2);
  });

  it("snapshot query returns nothing while unpublished", () => {
    const { projectId, v1 } = seed();
    publishArtifact(projectId, v1);
    db.prepare("UPDATE projects SET published_version_id = NULL WHERE id = ?").run(projectId);
    const row = db
      .prepare(
        `SELECT v.html FROM projects p
         JOIN artifacts a ON a.project_id = p.id AND a.seq = 1
         JOIN app_versions v ON v.id = a.version_id
         WHERE p.id = ? AND p.published_version_id IS NOT NULL`
      )
      .get(projectId);
    expect(row).toBeUndefined();
  });
});
