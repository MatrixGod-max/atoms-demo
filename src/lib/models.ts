/** Model registry and generation modes (stage-mixed pipelines). */

export interface ModelInfo {
  id: string;
  /** short badge shown in the stage timeline */
  badge: string;
  name: string;
  apiModel: string;
}

/**
 * Internal model tokens: `<api-model>` = non-thinking, `<api-model>:thinking` =
 * thinking mode. The API layer (agent.ts resolveModel) splits the token into the
 * request's `model` + `thinking` params — DeepSeek v4 selects reasoning via the
 * `thinking` parameter on a single model name, not separate model names.
 */
export const MODELS: ModelInfo[] = [
  { id: "chat", badge: "V4", name: "DeepSeek V4 Flash · 非思考", apiModel: "deepseek-v4-flash" },
  { id: "reasoner", badge: "V4思考", name: "DeepSeek V4 Flash · 思考", apiModel: "deepseek-v4-flash:thinking" },
];

export type GenerationMode = "fast" | "mixed" | "deep";
export const MODES: { id: GenerationMode; label: string; desc: string }[] = [
  { id: "fast", label: "⚡ 快速", desc: "全阶段 V4 非思考:最快,日常迭代首选" },
  { id: "mixed", label: "🧠 混合", desc: "思考模式负责研究/规划/评审,非思考负责编码(写得快)" },
  { id: "deep", label: "🐢 深度", desc: "全阶段思考模式:最强推理,速度最慢" },
];

export type PipelineStage = "researcher" | "pm" | "architect" | "planner" | "engineer" | "reviewer";

const CHAT = "deepseek-v4-flash";
const REASONER = "deepseek-v4-flash:thinking";

export function normalizeMode(mode: unknown): GenerationMode {
  return mode === "mixed" || mode === "deep" ? mode : "fast";
}

export function stageModels(mode: GenerationMode): Record<PipelineStage, string> {
  if (mode === "deep") {
    return { researcher: REASONER, pm: REASONER, architect: REASONER, planner: REASONER, engineer: REASONER, reviewer: REASONER };
  }
  if (mode === "mixed") {
    return { researcher: REASONER, pm: REASONER, architect: REASONER, planner: REASONER, engineer: CHAT, reviewer: REASONER };
  }
  return { researcher: CHAT, pm: CHAT, architect: CHAT, planner: CHAT, engineer: CHAT, reviewer: CHAT };
}

export function modelBadge(apiModel: string): string {
  return MODELS.find((m) => m.apiModel === apiModel)?.badge ?? apiModel;
}
