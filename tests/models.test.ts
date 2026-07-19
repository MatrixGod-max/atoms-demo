import { describe, expect, it } from "vitest";
import { normalizeMode, stageModels, modelBadge } from "@/lib/models";

describe("generation modes", () => {
  it("fast uses chat everywhere", () => {
    const sm = stageModels("fast");
    expect(Object.values(sm).every((m) => m === "deepseek-chat")).toBe(true);
  });
  it("mixed uses reasoner for thinking stages and chat for engineering", () => {
    const sm = stageModels("mixed");
    expect(sm.researcher).toBe("deepseek-reasoner");
    expect(sm.planner).toBe("deepseek-reasoner");
    expect(sm.reviewer).toBe("deepseek-reasoner");
    expect(sm.engineer).toBe("deepseek-chat");
  });
  it("deep uses reasoner everywhere", () => {
    const sm = stageModels("deep");
    expect(Object.values(sm).every((m) => m === "deepseek-reasoner")).toBe(true);
  });
  it("normalizeMode rejects unknown values to fast", () => {
    expect(normalizeMode("mixed")).toBe("mixed");
    expect(normalizeMode("deep")).toBe("deep");
    expect(normalizeMode("gpt-99")).toBe("fast");
    expect(normalizeMode(undefined)).toBe("fast");
  });
  it("modelBadge maps api models to short badges", () => {
    expect(modelBadge("deepseek-chat")).toBe("V3");
    expect(modelBadge("deepseek-reasoner")).toBe("R1");
  });
});
