/**
 * The fair comparison's definitions, shared by compare-bhh.ts and export-deck.ts so the deck's
 * charts and the printed comparison can't drift apart: each case collapses to one score, the
 * highest self-harm probability; positives are suicidal_ideation + self_harm, negatives no_crisis.
 */

import type { UserSignals } from "../src";
import type { BhhLabel } from "./fetch-bhh";

export const SELF_HARM_KEYS = [
  "ideation",
  "self_harm",
  "method_seeking",
  "plan",
  "means",
  "intent",
  "preparation",
  "imminent",
] as const satisfies readonly (keyof UserSignals)[];
export const POSITIVE: BhhLabel[] = ["suicidal_ideation", "self_harm"];
export const NEGATIVE: BhhLabel = "no_crisis";

export const score = (s: UserSignals) => Math.max(...SELF_HARM_KEYS.map((k) => s[k]));

/** AUC as P(score of a positive > score of a negative), ties counting half. */
export function auc(pos: number[], neg: number[]): number {
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

export const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
};
