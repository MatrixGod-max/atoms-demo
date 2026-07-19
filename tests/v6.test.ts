import { describe, expect, it } from "vitest";
import { extractUrls, isPrivateAddress } from "@/lib/research";
import { inlineImageAssets, validateAttachment, MAX_TEXT_BYTES } from "@/lib/attachments";

describe("research: URL extraction", () => {
  it("extracts at most two unique http(s) urls", () => {
    const urls = extractUrls("参考 https://a.com/x 和 https://a.com/x 以及 https://b.com 和 https://c.com");
    expect(urls).toEqual(["https://a.com/x", "https://b.com"]);
  });
  it("ignores non-http schemes", () => {
    expect(extractUrls("file:///etc/passwd ftp://x.com")).toEqual([]);
  });
});

describe("research: SSRF guard", () => {
  it("rejects loopback, private, link-local, metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.234.201.214", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "104.16.132.229", "2606:4700::6810:84e5"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe("attachments", () => {
  it("inlines asset:// references as data URIs", () => {
    const html = '<img src="asset://logo.png"><div style=\'background:url("asset://logo.png")\'></div>';
    const out = inlineImageAssets(html, [
      { filename: "logo.png", kind: "image", mime: "image/png", dataUri: "data:image/png;base64,AAAA" },
    ]);
    expect(out).not.toContain("asset://");
    expect(out.match(/data:image\/png;base64,AAAA/g)?.length).toBe(2);
  });
  it("validates mime, size, and count limits", () => {
    expect(validateAttachment("text/csv", 1024, 0)).toBeNull();
    expect(validateAttachment("application/zip", 10, 0)).toMatch(/仅支持/);
    expect(validateAttachment("text/plain", MAX_TEXT_BYTES + 1, 0)).toMatch(/不能超过/);
    expect(validateAttachment("image/png", 1024, 6)).toMatch(/最多/);
    expect(validateAttachment("text/plain", 0, 0)).toMatch(/为空/);
  });
});
