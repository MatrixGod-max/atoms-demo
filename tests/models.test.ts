import { describe, expect, it } from "vitest";
import { normalizeMode, stageModels, modelBadge } from "@/lib/models";

const CHAT = "deepseek-v4-flash";
const REASONER = "deepseek-v4-flash:thinking";

describe("generation modes", () => {
  it("fast uses non-thinking everywhere", () => {
    const sm = stageModels("fast");
    expect(Object.values(sm).every((m) => m === CHAT)).toBe(true);
  });
  it("mixed uses thinking for planning stages and non-thinking for engineering", () => {
    const sm = stageModels("mixed");
    expect(sm.researcher).toBe(REASONER);
    expect(sm.planner).toBe(REASONER);
    expect(sm.reviewer).toBe(REASONER);
    expect(sm.engineer).toBe(CHAT);
  });
  it("deep uses thinking everywhere", () => {
    const sm = stageModels("deep");
    expect(Object.values(sm).every((m) => m === REASONER)).toBe(true);
  });
  it("normalizeMode rejects unknown values to fast", () => {
    expect(normalizeMode("mixed")).toBe("mixed");
    expect(normalizeMode("deep")).toBe("deep");
    expect(normalizeMode("gpt-99")).toBe("fast");
    expect(normalizeMode(undefined)).toBe("fast");
  });
  it("modelBadge maps model tokens to short badges", () => {
    expect(modelBadge(CHAT)).toBe("V4");
    expect(modelBadge(REASONER)).toBe("V4思考");
  });
});
