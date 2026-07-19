import { describe, expect, it } from "vitest";
import { serveAppHtml } from "@/lib/serveApp";

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>app</body></html>`;

async function body(res: Response): Promise<string> {
  return await res.text();
}

describe("PWA injection for mobile artifacts", () => {
  it("mobile latest gets manifest link, mobile meta, and SW registration", async () => {
    const out = await body(serveAppHtml(HTML, "abc123", { platform: "mobile" }));
    expect(out).toContain('rel="manifest"');
    expect(out).toContain("/api/apps/abc123/manifest.webmanifest");
    expect(out).toContain("theme-color");
    expect(out).toContain("apple-mobile-web-app-capable");
    expect(out).toContain("serviceWorker");
  });

  it("mobile snapshot keeps manifest but does not register a SW", async () => {
    const out = await body(serveAppHtml(HTML, "abc123", { platform: "mobile", snapshot: true }));
    expect(out).toContain('rel="manifest"');
    expect(out).not.toContain("serviceWorker");
  });

  it("web apps get no PWA injection", async () => {
    const out = await body(serveAppHtml(HTML, "abc123", { platform: "web" }));
    expect(out).not.toContain('rel="manifest"');
    expect(out).not.toContain("serviceWorker");
    expect(out).toContain("window.quark"); // storage helper still present
  });

  it("does not duplicate meta the generated app already has", async () => {
    const withMeta = HTML.replace("<head>", '<head><meta name="theme-color" content="#fff">');
    const out = await body(serveAppHtml(withMeta, "abc123", { platform: "mobile" }));
    expect(out.match(/name="theme-color"/g)?.length).toBe(1);
  });
});
