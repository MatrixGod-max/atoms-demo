/** Model registry and generation modes (stage-mixed pipelines). */

export interface ModelInfo {
  id: string;
  /** short badge shown in the stage timeline */
  badge: string;
  name: string;
  apiModel: string;
}

export const MODELS: ModelInfo[] = [
  { id: "chat", badge: "V3", name: "DeepSeek V3 · 对话", apiModel: "deepseek-chat" },
  { id: "reasoner", badge: "R1", name: "DeepSeek R1 · 推理", apiModel: "deepseek-reasoner" },
];

export type GenerationMode = "fast" | "mixed" | "deep";
export const MODES: { id: GenerationMode; label: string; desc: string }[] = [
  { id: "fast", label: "⚡ 快速", desc: "全阶段 DeepSeek V3:最快,日常迭代首选" },
  { id: "mixed", label: "🧠 混合", desc: "R1 负责研究/规划/评审(想得深),V3 负责编码(写得快)" },
  { id: "deep", label: "🐢 深度", desc: "全阶段 R1:最强推理,速度最慢" },
];

export type PipelineStage = "researcher" | "planner" | "engineer" | "reviewer";

const CHAT = "deepseek-chat";
const REASONER = "deepseek-reasoner";

export function normalizeMode(mode: unknown): GenerationMode {
  return mode === "mixed" || mode === "deep" ? mode : "fast";
}

export function stageModels(mode: GenerationMode): Record<PipelineStage, string> {
  if (mode === "deep") {
    return { researcher: REASONER, planner: REASONER, engineer: REASONER, reviewer: REASONER };
  }
  if (mode === "mixed") {
    return { researcher: REASONER, planner: REASONER, engineer: CHAT, reviewer: REASONER };
  }
  return { researcher: CHAT, planner: CHAT, engineer: CHAT, reviewer: CHAT };
}

export function modelBadge(apiModel: string): string {
  return MODELS.find((m) => m.apiModel === apiModel)?.badge ?? apiModel;
}
