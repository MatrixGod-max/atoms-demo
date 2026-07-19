import { describe, expect, it } from "vitest";
import { stripFences, extractJson } from "@/lib/agent";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

describe("stripFences", () => {
  it("removes markdown code fences", () => {
    expect(stripFences("```html\n<!DOCTYPE html><p>x</p>\n```")).toBe("<!DOCTYPE html><p>x</p>");
  });
  it("keeps plain html untouched", () => {
    expect(stripFences("<!DOCTYPE html><p>x</p>")).toBe("<!DOCTYPE html><p>x</p>");
  });
});

describe("extractJson", () => {
  it("extracts the JSON object from chatty output", () => {
    expect(JSON.parse(extractJson('好的,规格如下:\n{"name":"应用","features":["a"]}\n希望有帮助'))).toEqual({
      name: "应用",
      features: ["a"],
    });
  });
  it("throws when no JSON present", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("secret123");
    expect(verifyPassword("secret123", stored)).toBe(true);
    expect(verifyPassword("secret124", stored)).toBe(false);
    expect(verifyPassword("secret123", "malformed")).toBe(false);
  });
  it("salts hashes (same password, different hash)", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then rejects with retryAfter", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const rejected = rateLimit(key, 3, 60_000);
    expect(rejected.ok).toBe(false);
    expect(rejected.retryAfterSec).toBeGreaterThan(0);
  });
  it("isolates keys", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });
});
