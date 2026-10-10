import bhh from "@/slides/data/bhh.json";

/**
 * The models on the BHH charts, in legend order, each with its fixed colour: the colour follows
 * the model on every chart. From slides/data/bhh.json (`pnpm --filter firstread export:deck`).
 */
const COLORS = {
  jev: "var(--color-series-1)",
  luna: "var(--color-series-2)",
  gemini: "var(--color-series-3)",
  deepseek: "var(--color-series-4)",
  glm: "var(--color-series-5)",
} as const;

export const MODELS = (Object.keys(COLORS) as (keyof typeof COLORS)[]).map((id) => ({
  id,
  color: COLORS[id],
  run: bhh.runs.find((r) => r.id === id)!,
}));
export type Model = (typeof MODELS)[number];

export const jev = MODELS[0]!;
export const others = MODELS.slice(1);
