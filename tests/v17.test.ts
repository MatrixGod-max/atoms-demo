import { describe, expect, it } from "vitest";
import { buildProject } from "@/lib/build";
import { concatSources, mergeFiles, parseFileStream, sanitizePath, validateFiles } from "@/lib/projectFiles";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";
import { jobRunner } from "@/lib/jobs";

function makeProjectUser(engine: "single" | "project"): { userId: string; projectId: string } {
  const userId = newId("u");
  const projectId = newId("p");
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, 'x', ?)").run(
    userId,
    `${userId}@test.dev`,
    "t",
    now()
  );
  db.prepare("INSERT INTO projects (id, user_id, name, engine, created_at, updated_at) VALUES (?, ?, 'test', ?, ?, ?)").run(
    projectId,
    userId,
    engine,
    now(),
    now()
  );
  return { userId, projectId };
}

async function waitForTerminal(jobId: string, timeoutMs = 60_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = jobRunner.getJob(jobId);
    if (job && (job.status === "done" || job.status === "error")) return job.status;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("job did not finish in time");
}

function latestVersion(projectId: string): { html: string; files: string | null } {
  return db
    .prepare("SELECT html, files FROM app_versions WHERE project_id = ? ORDER BY num DESC LIMIT 1")
    .get(projectId) as { html: string; files: string | null };
}

const REACT_PROJECT = {
  "index.html": `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>计数器</title><link rel="stylesheet" href="styles.css"></head>
<body><div id="root"></div><script src="src/main.jsx"></script></body></html>
`,
  "src/main.jsx": `import { createRoot } from "react-dom/client";
import { useState } from "react";
function App() {
  const [n, setN] = useState(0);
  return <button id="b" onClick={() => setN(n + 1)}><span id="n">{n}</span></button>;
}
createRoot(document.getElementById("root")).render(<App />);
`,
  "styles.css": `#b { font-size: 20px; }
`,
};

describe("build.ts: esbuild 打包为自包含单 HTML", () => {
  it("bundles a React/JSX project", async () => {
    const res = await buildProject(REACT_PROJECT);
    expect(res.ok).toBe(true);
    expect(res.html).toContain("<!DOCTYPE html>");
    expect(res.html).toContain("createRoot");
    expect(res.html).toContain("#b { font-size: 20px; }");
    expect(res.html).not.toMatch(/<script\s+[^>]*src=/i);
    expect(res.html).not.toMatch(/<link\s+[^>]*stylesheet/i);
    expect(res.meta.bundleBytes).toBeGreaterThan(10_000); // react bundled in
  }, 30_000);

  it("reports structured build errors", async () => {
    const res = await buildProject({
      "index.html": `<html><head></head><body><script src="src/main.js"></script></body></html>`,
      "src/main.js": `const x = {;\n`,
    });
    expect(res.ok).toBe(false);
    expect(res.errors![0].file).toBe("src/main.js");
    expect(res.errors![0].line).toBe(1);
  }, 30_000);

  it("rejects non-whitelisted bare imports", async () => {
    const res = await buildProject({
      "index.html": `<html><body><script src="src/main.js"></script></body></html>`,
      "src/main.js": `import _ from "lodash";\nconsole.log(_);\n`,
    });
    expect(res.ok).toBe(false);
    expect(res.errors!.map((e) => e.text).join()).toContain("白名单");
  }, 30_000);

  it("fails on missing local module and missing entry", async () => {
    const missing = await buildProject({
      "index.html": `<html><body><script src="src/main.js"></script></body></html>`,
      "src/main.js": `import { x } from "./nope";\nconsole.log(x);\n`,
    });
    expect(missing.ok).toBe(false);
    const noEntry = await buildProject({ "src/main.js": "console.log(1)\n" });
    expect(noEntry.ok).toBe(false);
    expect(noEntry.errors![0].text).toContain("index.html");
  }, 30_000);
});

describe("工程模式端到端(mock 流水线,真实 esbuild 构建)", () => {
  it("first generation persists source tree + built bundle", async () => {
    const { userId, projectId } = makeProjectUser("project");
    const { jobId } = jobRunner.start(projectId, userId, "做一个计数器");
    expect(await waitForTerminal(jobId)).toBe("done");
    const v = latestVersion(projectId);
    const files = JSON.parse(v.files!) as Record<string, string>;
    expect(Object.keys(files).sort()).toEqual(["index.html", "src/main.jsx", "styles.css"]);
    // html column is the build artifact: self-contained, no local refs, react bundled.
    expect(v.html).toContain("<!DOCTYPE html>");
    expect(v.html).not.toMatch(/<script\s+[^>]*src=/i);
    expect(v.html.length).toBeGreaterThan(50_000);
    // build stage visible in the replay
    const sub = jobRunner.subscribe(jobId, () => {});
    const stages = sub.replay.map((p) => JSON.parse(p)).filter((e) => e.type === "stage").map((e) => e.stage);
    sub.detach();
    expect(stages).toContain("build");
  }, 90_000);

  it("iteration merges changed files onto the previous tree", async () => {
    const { userId, projectId } = makeProjectUser("project");
    const first = jobRunner.start(projectId, userId, "做一个计数器");
    expect(await waitForTerminal(first.jobId)).toBe("done");
    const second = jobRunner.start(projectId, userId, "改样式");
    expect(await waitForTerminal(second.jobId)).toBe("done");
    const v = latestVersion(projectId);
    const files = JSON.parse(v.files!) as Record<string, string>;
    expect(files["styles.css"]).toContain("mock-iterated");
    expect(files["src/main.jsx"]).toContain("createRoot"); // untouched files carried over
  }, 120_000);

  it("build-error repair loop recovers and reports the round", async () => {
    const { userId, projectId } = makeProjectUser("project");
    const { jobId } = jobRunner.start(projectId, userId, "MOCK_BUILD_BROKEN 计数器");
    expect(await waitForTerminal(jobId)).toBe("done");
    const sub = jobRunner.subscribe(jobId, () => {});
    const infos = sub.replay
      .map((p) => JSON.parse(p))
      .filter((e) => e.type === "stage" && e.stage === "build" && e.info)
      .map((e) => e.info as string);
    sub.detach();
    expect(infos.join("|")).toContain("构建错误");
    expect(infos.join("|")).toContain("修复");
    expect(latestVersion(projectId).html).toContain("<!DOCTYPE html>");
  }, 90_000);
});

describe("projectFiles: 协议解析与限额", () => {
  it("parses FILE/DELETE markers and merges", () => {
    const parsed = parseFileStream(
      `===== FILE: index.html =====\n<html></html>\n===== FILE: src/a.js =====\nconsole.log(1)\n===== DELETE: src/old.js =====\n`
    );
    expect(Object.keys(parsed.files)).toEqual(["index.html", "src/a.js"]);
    expect(parsed.deletes).toEqual(["src/old.js"]);
    const merged = mergeFiles({ "src/old.js": "x\n", "keep.css": "y\n" }, parsed);
    expect(merged["src/old.js"]).toBeUndefined();
    expect(merged["keep.css"]).toBe("y\n");
    expect(merged["src/a.js"]).toContain("console.log");
  });

  it("strips a wrapping code fence inside a file section", () => {
    const parsed = parseFileStream("===== FILE: src/a.js =====\n```js\nconsole.log(1)\n```\n");
    expect(parsed.files["src/a.js"]).toBe("console.log(1)\n");
  });

  it("sanitizes hostile paths", () => {
    expect(sanitizePath("../../etc/passwd")).toBeNull();
    expect(sanitizePath("/abs.js")).toBeNull();
    expect(sanitizePath("a.exe")).toBeNull();
    expect(sanitizePath("./src/ok.tsx")).toBe("src/ok.tsx");
  });

  it("validates caps and entry presence", () => {
    expect(validateFiles({})).toContain("源文件");
    expect(validateFiles({ "a.js": "x" })).toContain("index.html");
    expect(validateFiles({ "index.html": "<html>", "big.js": "x".repeat(70_000) })).toContain("64KB");
    expect(validateFiles({ "index.html": "<html>", "a.js": "ok" })).toBeNull();
  });

  it("concatSources truncates under a byte budget", () => {
    const out = concatSources({ "index.html": "a".repeat(100), "b.js": "b".repeat(100) }, 120);
    expect(out).toContain("===== FILE: index.html =====");
    expect(out).toContain("截断");
  });
});

describe("zip + 计费", () => {
  it("createZip emits a valid archive (magic numbers, entry count, utf-8 names)", async () => {
    const { createZip } = await import("@/lib/zip");
    const buf = createZip({ "index.html": "<html></html>", "src/主逻辑.jsx": "export {}\n", "README.md": "# hi\n" });
    expect(buf.readUInt32LE(0)).toBe(0x04034b50); // local file header
    const eocd = buf.length - 22;
    expect(buf.readUInt32LE(eocd)).toBe(0x06054b50); // end of central directory
    expect(buf.readUInt16LE(eocd + 10)).toBe(3); // total entries
    expect(buf.toString("utf8")).toContain("src/主逻辑.jsx");
  });

  it("prices the project-engine surcharge", async () => {
    const { generationCost } = await import("@/lib/credits");
    expect(generationCost("fast", false, false, false, true)).toBe(2);
    expect(generationCost("deep", true, true, true, true)).toBe(10);
    expect(generationCost("fast", false, false)).toBe(1);
  });
});
