import type { UserSignals } from "firstread";
import {
  BORDERLINE_SCORE,
  CRISIS_CUTOFFS,
  type Cutoff,
  ELEVATED_CUTOFFS,
  FOLLOW_UP_CONFIRMS,
  FOLLOW_UPS,
  PLAN_MEANS_CUTOFFS,
  type RiskLevel,
  WATCH_CUTOFFS,
  levelEvidence,
  noisyOr,
} from "firstread/policy";
import recording from "@/slides/data/replay-crisis.json";
import type { RecordedTurn, Recording } from "./replay";

/**
 * The slide's message: the turn of the recorded crisis scenario where the companion was stopped
 * ("i've decided, it's tonight..."), with Jev's answers and timing as recorded.
 */
export const LADDER_TURN: RecordedTurn = (recording as Recording).turns.find((t) => t.data.audit?.shortCircuit === "crisis")!;

/**
 * The deck's simplified ladder of rules from Jev's answers to a level (HY-168), for one message:
 * every cutoff comes from policy.ts, and the rules lit are the ones levelEvidence() gives as the
 * reason, so the slide can't drift from the code. A few rules per level, not all of them.
 */

export type Part = { signal: keyof UserSignals; cutoff: number; value: number };
export type LadderRule = {
  level: Exclude<RiskLevel, "NONE">;
  /** All parts must be met, or with `anyOf` one of them. */
  parts: Part[];
  anyOf?: boolean;
  /** Weak self-harm answers adding up (policy.ts noisyOr), which this rule also needs. */
  combined?: { cutoff: number; value: number };
  met: boolean;
  /** One of the rules that set this message's level. */
  lit: boolean;
};

/** The ELEVATED and WATCH rules the slide shows, out of policy.ts's full lists. */
const SHOWN: Partial<Record<RiskLevel, (keyof UserSignals)[]>> = {
  ELEVATED: ["ideation", "self_harm", "method_seeking"],
  WATCH: ["ideation", "self_harm"],
};

export function ladder(p: UserSignals): { level: RiskLevel; rules: LadderRule[] } {
  const evidence = levelEvidence(p);
  const parts = (cutoffs: readonly Cutoff[]): Part[] => cutoffs.map(([signal, cutoff]) => ({ signal, cutoff, value: p[signal] }));
  const pick = (level: RiskLevel, cutoffs: readonly Cutoff[]) => cutoffs.filter(([signal]) => SHOWN[level]!.includes(signal));
  // A rule is lit when every part it was met by is among the answers that set the level.
  const inEvidence = (level: RiskLevel, ps: Part[]) =>
    evidence.level === level && ps.every((x) => evidence.answers.some((a) => a.signal === x.signal && a.cutoff === x.cutoff));
  const single = (level: LadderRule["level"]) => (part: Part): LadderRule => {
    const met = part.value >= part.cutoff;
    return { level, parts: [part], met, lit: met && inEvidence(level, [part]) };
  };

  const planMeans = parts(PLAN_MEANS_CUTOFFS);
  const planMeansMet = planMeans.every((x) => x.value >= x.cutoff);
  const followUps = parts(FOLLOW_UPS.map((k) => [k, FOLLOW_UP_CONFIRMS] as const));
  const combined = noisyOr(p);
  const followUpMet = combined >= BORDERLINE_SCORE && followUps.some((x) => x.value >= x.cutoff);

  const rules: LadderRule[] = [
    ...parts(CRISIS_CUTOFFS).map(single("CRISIS")),
    { level: "CRISIS", parts: planMeans, met: planMeansMet, lit: planMeansMet && inEvidence("CRISIS", planMeans) },
    ...parts(pick("ELEVATED", ELEVATED_CUTOFFS)).map(single("ELEVATED")),
    {
      level: "ELEVATED",
      parts: followUps,
      anyOf: true,
      combined: { cutoff: BORDERLINE_SCORE, value: combined },
      met: followUpMet,
      lit:
        followUpMet &&
        evidence.combined !== null &&
        inEvidence("ELEVATED", followUps.filter((x) => x.value >= x.cutoff)),
    },
    ...parts(pick("WATCH", WATCH_CUTOFFS)).map(single("WATCH")),
  ];
  return { level: evidence.level, rules };
}
