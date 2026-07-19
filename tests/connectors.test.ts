import { describe, expect, it } from "vitest";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import {
  CONNECTORS,
  SLACK_WEBHOOK_RE,
  connectorsHelper,
  getCredential,
  maskSecret,
  mintPreviewToken,
  parseConnectors,
  runConnector,
  verifyPreviewToken,
} from "@/lib/connectors";

const P = (o: Record<string, string>) => new URLSearchParams(o);

function makeUser(): string {
  const id = newId("u");
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, 't', 'x', ?)").run(
    id,
    `${id}@test.dev`,
    now()
  );
  return id;
}

function putCredential(userId: string, connector: string, secret: string) {
  const t = now();
  db.prepare(
    `INSERT INTO connector_credentials (user_id, connector, secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, connector) DO UPDATE SET secret = excluded.secret, updated_at = excluded.updated_at`
  ).run(userId, connector, secret, t, t);
}

describe("connector registry", () => {
  it("has 8 connectors and every token connector carries a credential spec", () => {
    expect(CONNECTORS.length).toBe(8);
    for (const c of CONNECTORS.filter((c) => c.kind === "token")) {
      expect(c.credential?.label).toBeTruthy();
      expect(c.credential?.help).toBeTruthy();
    }
    expect(CONNECTORS.find((c) => c.id === "gdrive")?.kind).toBe("keyless");
  });

  it("parseConnectors keeps new ids and drops unknown ones", () => {
    expect(parseConnectors('["github","gdrive","nope"]')).toEqual(["github", "gdrive"]);
  });
});

describe("preview tokens", () => {
  it("mint/verify roundtrip, rejects unknown and expired", () => {
    const pt = mintPreviewToken("u1", "p1");
    expect(verifyPreviewToken(pt)).toEqual({ userId: "u1", projectId: "p1" });
    expect(verifyPreviewToken("pt_nope")).toBeNull();
    expect(verifyPreviewToken(null)).toBeNull();
    const expired = mintPreviewToken("u1", "p1", -1);
    expect(verifyPreviewToken(expired)).toBeNull();
  });
});

describe("credentials", () => {
  it("upsert, read and mask", () => {
    const uid = makeUser();
    expect(getCredential(uid, "github")).toBeNull();
    putCredential(uid, "github", "ghp_1234567890abcdef");
    expect(getCredential(uid, "github")).toBe("ghp_1234567890abcdef");
    putCredential(uid, "github", "ghp_replaced9876543");
    expect(getCredential(uid, "github")).toBe("ghp_replaced9876543");
    expect(maskSecret("short")).toBe("••••••");
    expect(maskSecret("ghp_1234567890abcdef")).toBe("ghp_12……ef");
  });

  it("slack webhook regex blocks non-slack targets (SSRF guard)", () => {
    expect(SLACK_WEBHOOK_RE.test("https://hooks.slack.com/services/T0/B0/xyz")).toBe(true);
    expect(SLACK_WEBHOOK_RE.test("http://hooks.slack.com/services/x")).toBe(false);
    expect(SLACK_WEBHOOK_RE.test("https://evil.example.com/hooks.slack.com")).toBe(false);
    expect(SLACK_WEBHOOK_RE.test("https://169.254.169.254/latest")).toBe(false);
  });
});

describe("param whitelists (rejected before any network call)", () => {
  const secretCtx = { secret: "tok_x_123456", userId: "u1" };
  it("github", async () => {
    await expect(runConnector("github", P({ op: "zap", repo: "a/b" }), secretCtx)).rejects.toThrow(/op/);
    await expect(runConnector("github", P({ op: "repo", repo: "justaname" }), secretCtx)).rejects.toThrow(/repo/);
    await expect(runConnector("github", P({ op: "file", repo: "a/b", path: "../etc" }), secretCtx)).rejects.toThrow(/path/);
    await expect(runConnector("github", P({ op: "repo", repo: "a/b" }), {})).rejects.toThrow(/未配置凭证/);
  });
  it("figma", async () => {
    await expect(runConnector("figma", P({ fileKey: "no!" }), secretCtx)).rejects.toThrow(/fileKey/);
    await expect(runConnector("figma", P({ fileKey: "abcdefgh1234", nodeId: "xx" }), secretCtx)).rejects.toThrow(/nodeId/);
  });
  it("notion", async () => {
    await expect(runConnector("notion", P({}), secretCtx)).rejects.toThrow(/database_id 或 page_id/);
    await expect(runConnector("notion", P({ database_id: "not-hex" }), secretCtx)).rejects.toThrow(/database_id 或 page_id/);
  });
  it("gdrive", async () => {
    await expect(runConnector("gdrive", P({ fileId: "short" }))).rejects.toThrow(/fileId/);
    await expect(runConnector("gdrive", P({ fileId: "a".repeat(20), type: "zip" }))).rejects.toThrow(/type/);
  });
  it("slack", async () => {
    await expect(runConnector("slack", P({ text: "" }), secretCtx)).rejects.toThrow(/text/);
    await expect(runConnector("slack", P({ text: "x".repeat(501) }), secretCtx)).rejects.toThrow(/text/);
    await expect(
      runConnector("slack", P({ text: "hi" }), { secret: "https://evil.example.com/x", userId: "u1" })
    ).rejects.toThrow(/Webhook/);
  });
});

describe("mock happy paths (CONNECTOR_MOCK=1)", () => {
  const ctx = { secret: "tok_x_123456", userId: "u1" };
  const slackCtx = { secret: "https://hooks.slack.com/services/T/B/x", userId: "u1" };
  it("github repo/issues/file", async () => {
    const repo = JSON.parse((await runConnector("github", P({ op: "repo", repo: "a/b" }), ctx)).body);
    expect(repo.full_name).toBe("a/b");
    const issues = JSON.parse((await runConnector("github", P({ op: "issues", repo: "a/b" }), ctx)).body);
    expect(issues.issues[0].title).toBeTruthy();
    const file = JSON.parse((await runConnector("github", P({ op: "file", repo: "a/b", path: "README.md" }), ctx)).body);
    expect(file.content).toBeTruthy();
  });
  it("figma file/image", async () => {
    const f = JSON.parse((await runConnector("figma", P({ fileKey: "abcdefgh1234" }), ctx)).body);
    expect(f.pages.length).toBeGreaterThan(0);
    const img = JSON.parse((await runConnector("figma", P({ fileKey: "abcdefgh1234", nodeId: "1:2" }), ctx)).body);
    expect(img.image).toBeTruthy();
  });
  it("notion db/page", async () => {
    const id = "a".repeat(32);
    const rows = JSON.parse((await runConnector("notion", P({ database_id: id }), ctx)).body);
    expect(rows.rows.length).toBeGreaterThan(0);
    const blocks = JSON.parse((await runConnector("notion", P({ page_id: id }), ctx)).body);
    expect(blocks.blocks.length).toBeGreaterThan(0);
  });
  it("gdrive and slack", async () => {
    const d = JSON.parse((await runConnector("gdrive", P({ fileId: "a".repeat(20) }))).body);
    expect(d.content).toBeTruthy();
    const s = JSON.parse((await runConnector("slack", P({ text: "hi" }), slackCtx)).body);
    expect(s.ok).toBe(true);
  });
});

describe("connectorsHelper", () => {
  it("carries pt for token connectors in preview and none for keyless", () => {
    const s = connectorsHelper(["weather", "github"], "", "pt_abc");
    expect(s).toContain("github:async function");
    expect(s).toContain("q.set('pt',\"pt_abc\")");
    const weatherPart = s.split("github:")[0];
    expect(weatherPart).not.toContain("pt_abc");
  });
  it("injects reject stubs for token connectors without a preview token", () => {
    const s = connectorsHelper(["weather", "github"], "");
    expect(s).toContain("仅工作台预览可用");
    expect(s).toContain("weather:async function");
  });
  it("returns empty for no connectors", () => {
    expect(connectorsHelper([], "")).toBe("");
  });
});
