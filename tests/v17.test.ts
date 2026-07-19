import { describe, expect, it } from "vitest";
import { buildProject } from "@/lib/build";
import { concatSources, mergeFiles, parseFileStream, sanitizePath, validateFiles } from "@/lib/projectFiles";

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
