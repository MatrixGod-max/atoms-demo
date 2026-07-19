import { describe, expect, it } from "vitest";
import { validateDomainName } from "@/lib/domains";
import { generationCost } from "@/lib/credits";
import { parseConnectors, runConnector } from "@/lib/connectors";

describe("domain validation", () => {
  it("accepts normal names", () => {
    expect(validateDomainName("myapp")).toBeNull();
    expect(validateDomainName("my-app-2026")).toBeNull();
  });
  it("rejects bad shapes and reserved names", () => {
    expect(validateDomainName("ab")).toMatch(/3-30/);
    expect(validateDomainName("-abc")).toMatch(/3-30/);
    expect(validateDomainName("ABC")).toMatch(/3-30/);
    expect(validateDomainName("www")).toMatch(/保留/);
    expect(validateDomainName("api")).toMatch(/保留/);
  });
});

describe("generation cost", () => {
  it("prices by mode with research/team surcharges", () => {
    expect(generationCost("fast", false, false)).toBe(1);
    expect(generationCost("mixed", false, false)).toBe(3);
    expect(generationCost("deep", false, false)).toBe(5);
    expect(generationCost("fast", true, true)).toBe(3);
    expect(generationCost("deep", true, true)).toBe(7);
  });
});

describe("connectors", () => {
  it("parses stored json defensively", () => {
    expect(parseConnectors('["weather","rates","nope"]')).toEqual(["weather", "rates"]);
    expect(parseConnectors("broken")).toEqual([]);
    expect(parseConnectors(null)).toEqual([]);
  });
  it("rejects invalid parameters before any upstream call", async () => {
    await expect(runConnector("weather", new URLSearchParams({ latitude: "999", longitude: "0" }))).rejects.toThrow();
    await expect(runConnector("rates", new URLSearchParams({ from: "US1", to: "CNY" }))).rejects.toThrow();
    await expect(runConnector("qr", new URLSearchParams())).rejects.toThrow();
    await expect(runConnector("hack", new URLSearchParams())).rejects.toThrow();
  });
  it("qr connector renders locally", async () => {
    const { body } = await runConnector("qr", new URLSearchParams({ text: "hello" }));
    expect(JSON.parse(body).svg).toContain("<svg");
  });
});
