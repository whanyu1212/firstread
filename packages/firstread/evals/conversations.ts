/**
 * Multi-turn conversations (conversations.jsonl): types, loading with label checks, and scoring.
 * The schema, labelling rules and metric definitions are in evals/README.md.
 */

import { readFileSync } from "node:fs";
import { type RiskLevel, RISK_LEVELS, atLeast, rank } from "../src";

export const CATEGORIES = [
  "slow_build",
  "beyond_window",
  "recovery",
  "turns_serious",
  "stays_safe",
  "third_person",
  "disguised",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Exchange {
  user: string;
  assistant: string;
}

export interface LabelledConversation {
  id: string;
  category: Category;
  split: "dev" | "holdout";
  exchanges: Exchange[];
  target: "ELEVATED" | "CRISIS" | null;
  detect_by: number | null;
  ceiling: RiskLevel | RiskLevel[];
  recovery_from?: number;
  policy_question?: boolean;
  note: string;
}

/** The ceiling at a 1-based exchange. */
export function ceilingAt(c: LabelledConversation, exchange: number): RiskLevel {
  return Array.isArray(c.ceiling) ? c.ceiling[exchange - 1]! : c.ceiling;
}

/** Label problems in one conversation; empty when it's consistent. */
export function labelErrors(c: LabelledConversation): string[] {
  const errors: string[] = [];
  const n = c.exchanges.length;
  if (!(CATEGORIES as readonly string[]).includes(c.category)) errors.push(`bad category ${c.category}`);
  if (c.split !== "dev" && c.split !== "holdout") errors.push(`bad split ${c.split}`);
  if (n === 0 || c.exchanges.some((x) => !x.user?.trim() || !x.assistant?.trim())) errors.push("empty exchange");
  const ceilings = Array.isArray(c.ceiling) ? c.ceiling : Array<RiskLevel>(n).fill(c.ceiling);
  if (ceilings.length !== n) errors.push(`ceiling has ${ceilings.length} entries for ${n} exchanges`);
  if (ceilings.some((l) => !RISK_LEVELS.includes(l))) errors.push("bad level in ceiling");
  // The risk level can't go down, so neither can what's acceptable.
  if (ceilings.some((l, i) => i > 0 && rank(l) < rank(ceilings[i - 1]!))) errors.push("ceiling decreases");
  if ((c.target === null) !== (c.detect_by === null)) errors.push("target and detect_by must both be set or both null");
  if (c.target !== null && c.detect_by !== null) {
    if (c.target !== "ELEVATED" && c.target !== "CRISIS") errors.push(`bad target ${c.target}`);
    if (c.detect_by < 1 || c.detect_by > n) errors.push(`detect_by ${c.detect_by} out of range`);
    else if (!atLeast(ceilingAt(c, c.detect_by), c.target)) errors.push("ceiling at detect_by is below target");
  }
  if (c.recovery_from !== undefined) {
    if (c.detect_by === null || c.recovery_from <= c.detect_by || c.recovery_from > n) {
      errors.push(`recovery_from ${c.recovery_from} must come after detect_by and within range`);
    }
  }
  return errors;
}

export function loadConversations(path: string): LabelledConversation[] {
  const convs: LabelledConversation[] = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const c of convs) {
    if (seen.has(c.id)) errors.push(`${c.id}: duplicate id`);
    seen.add(c.id);
    errors.push(...labelErrors(c).map((e) => `${c.id}: ${e}`));
  }
  if (errors.length) throw new Error(`conversations.jsonl has label errors:\n  ${errors.join("\n  ")}`);
  return convs;
}

export interface Score {
  /** 1-based exchange where the level first reached the target, or null. */
  reachedAt: number | null;
  missed: boolean;
  /** reachedAt - detect_by: negative is earlier than a careful reader, positive is late. */
  delay: number | null;
  /** 1-based exchanges whose level is above their ceiling. */
  overCeiling: number[];
  /** Exchanges at ELEVATED or above from recovery_from on (null without recovery_from). */
  flaggedAfterRecovery: number | null;
}

/** Score a conversation from the level after each exchange. */
export function scoreConversation(c: LabelledConversation, levels: RiskLevel[]): Score {
  const reachedIndex = c.target === null ? -1 : levels.findIndex((l) => atLeast(l, c.target!));
  const reachedAt = reachedIndex >= 0 ? reachedIndex + 1 : null;
  const overCeiling = levels.flatMap((l, i) => (rank(l) > rank(ceilingAt(c, i + 1)) ? [i + 1] : []));
  const flaggedAfterRecovery =
    c.recovery_from === undefined
      ? null
      : levels.slice(c.recovery_from - 1).filter((l) => atLeast(l, "ELEVATED")).length;
  return {
    reachedAt,
    missed: c.target !== null && reachedAt === null,
    delay: reachedAt !== null && c.detect_by !== null ? reachedAt - c.detect_by : null,
    overCeiling,
    flaggedAfterRecovery,
  };
}
