/**
 * Turns Jev probabilities into a risk level and an action for the draft reply.
 *
 * Pure functions, no API calls, so they are easy to unit test and tune.
 *
 * Thresholds are tuned on evals/ (BHH, cases.jsonl, conversations.jsonl). They lean low,
 * because missing a real crisis costs far more than a false alarm.
 */

import type { ReplySignals, UserSignals } from "./questions";

export const RISK_LEVELS = [
  "NONE",
  "WATCH", // possible passive ideation or distress: keep an eye on it
  "ELEVATED", // active ideation, self-harm, or a plan: reply must point to support
  "CRISIS", // intent or imminence: hand off to a human now
] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type Action =
  | "send" // draft reply goes out unchanged
  | "replace" // swap the draft for a safe template reply
  | "escalate"; // send the crisis reply and alert a human reviewer

export const rank = (level: RiskLevel): number => RISK_LEVELS.indexOf(level);
export const atLeast = (level: RiskLevel, min: RiskLevel): boolean => rank(level) >= rank(min);

const SELF_HARM_SIGNALS = ["ideation", "self_harm", "plan", "means", "intent", "imminent"] as const;
/** Specific follow-ups: on validation they fired on SI/self-harm cases, almost never on no_crisis. */
const FOLLOW_UPS = ["own_death_wish", "disguised_request"] as const;

/** Borderline: not flagged ELEVATED on its own, but the self-harm signals add up to this much. */
export const BORDERLINE_SCORE = 0.2;
/** On a borderline turn, any follow-up at or above this confirms the risk. */
export const FOLLOW_UP_CONFIRMS = 0.5;

/**
 * Chance that at least one self-harm signal is real, treating them as independent evidence:
 * 1 - (1 - p1)(1 - p2)... The signals overlap, so this overstates risk: use it to rank, and
 * tune BORDERLINE_SCORE on evals rather than reading it as a probability.
 */
export function noisyOr(p: UserSignals): number {
  return 1 - SELF_HARM_SIGNALS.reduce((none, key) => none * (1 - p[key]), 1);
}

/** Preparation (gathering means, goodbye letters, giving things away) at or above this is CRISIS. */
export const PREPARATION_CRISIS = 0.4;

/**
 * Stated intent, or a sign of acting soon, at or above these is CRISIS. Jev gives both 0.2-0.36
 * on strong ideation with no plan or timing ("i've been thinking about killing myself"), so at 0.2
 * every such disclosure alerted a human. On the multi-turn dev conversations, these are the lowest
 * values that stop that while every real crisis still escalated (intent 0.6-0.8, imminent 0.5-0.6).
 */
export const INTENT_CRISIS = 0.35;
export const IMMINENT_CRISIS = 0.4;
/**
 * Below the CRISIS cutoffs, intent or imminence still counts: at or above these the turn is at
 * least ELEVATED, so raising the CRISIS cutoffs changed how severe a turn is, not whether it's
 * flagged. A veiled goodbye with nothing else firing (BHH test_001288: imminent 0.27) needs this.
 */
export const INTENT_ELEVATED = 0.2;
export const IMMINENT_ELEVATED = 0.2;

/** Asking how to self-injure, ease or hide injuries, or avoid care at or above this is ELEVATED. */
export const METHOD_SEEKING_ELEVATED = 0.4;

export type CrisisRoute = "intent" | "imminent" | "preparation" | "plan_means";

/** Which CRISIS rules a turn meets. Empty means the turn isn't CRISIS on its own. */
export function crisisRoutes(p: UserSignals): CrisisRoute[] {
  const routes: CrisisRoute[] = [];
  if (p.intent >= INTENT_CRISIS) routes.push("intent");
  if (p.imminent >= IMMINENT_CRISIS) routes.push("imminent");
  if (p.preparation >= PREPARATION_CRISIS) routes.push("preparation");
  if (p.plan >= 0.3 && p.means >= 0.3) routes.push("plan_means");
  return routes;
}

/** One of Jev's answers that set a reading, with the cutoff it met. */
export type LevelAnswer = { signal: keyof UserSignals; value: number; cutoff: number };

/**
 * Risk level for a single user turn, from yes/no probabilities. The conversation's level comes
 * from updateRisk() in risk.ts, which also weighs context and history.
 */
export function assessLevel(p: UserSignals): RiskLevel {
  return levelEvidence(p).level;
}

/**
 * assessLevel's reading together with the answers that set it, strongest first: what a presenter
 * or reviewer is shown as the reason for a level. NONE has no answers. `combined` is set when weak
 * self-harm answers adding up (noisyOr) were part of the reason, since no one of them was.
 */
export function levelEvidence(p: UserSignals): { level: RiskLevel; answers: LevelAnswer[]; combined: number | null } {
  const met = (rules: [keyof UserSignals, number][]): LevelAnswer[] =>
    rules
      .filter(([signal, cutoff]) => p[signal] >= cutoff)
      .map(([signal, cutoff]) => ({ signal, value: p[signal], cutoff }))
      .sort((a, b) => b.value - a.value);

  const routes = crisisRoutes(p);
  if (routes.length > 0) {
    const crisis: [keyof UserSignals, number][] = [
      ["intent", INTENT_CRISIS],
      ["imminent", IMMINENT_CRISIS],
      ["preparation", PREPARATION_CRISIS],
      ...(routes.includes("plan_means") ? ([["plan", 0.3], ["means", 0.3]] as [keyof UserSignals, number][]) : []),
    ];
    return { level: "CRISIS", answers: met(crisis), combined: null };
  }
  const elevated = met([
    ["intent", INTENT_ELEVATED],
    ["imminent", IMMINENT_ELEVATED],
    ["plan", 0.2],
    ["self_harm", 0.3],
    ["method_seeking", METHOD_SEEKING_ELEVATED],
    ["ideation", 0.4],
    ["harm_to_others", 0.4],
  ]);
  if (elevated.length > 0) return { level: "ELEVATED", answers: elevated, combined: null };
  // Weak signals that add up, confirmed by a follow-up. Follow-ups can only raise the level.
  const combined = noisyOr(p);
  if (combined >= BORDERLINE_SCORE) {
    const followUps = met(FOLLOW_UPS.map((key) => [key, FOLLOW_UP_CONFIRMS]));
    if (followUps.length > 0) return { level: "ELEVATED", answers: followUps, combined };
  }
  const watch = met([
    ["ideation", 0.15],
    ["self_harm", 0.15],
    ["harm_to_others", 0.2],
  ]);
  if (watch.length > 0) return { level: "WATCH", answers: watch, combined: null };
  // counselor_concern is too broad to escalate on (depression, grief, addiction), so only watch.
  if (combined >= BORDERLINE_SCORE && p.counselor_concern >= FOLLOW_UP_CONFIRMS) {
    return {
      level: "WATCH",
      answers: [{ signal: "counselor_concern", value: p.counselor_concern, cutoff: FOLLOW_UP_CONFIRMS }],
      combined,
    };
  }
  return { level: "NONE", answers: [], combined: null };
}

/**
 * Risk only goes up within a conversation.
 *
 * One calm message after a disclosure should not reset the conversation to
 * safe. Lowering the level is a decision for a human reviewer.
 */
export function escalate(previous: RiskLevel, current: RiskLevel): RiskLevel {
  return rank(current) > rank(previous) ? current : previous;
}

/** What to do with the draft reply, given the conversation's risk level. */
export function decideAction(
  level: RiskLevel,
  r: ReplySignals,
  /**
   * Whether this reply must point to support (risk.ts resourcesDue). Defaults to every reply at
   * ELEVATED, the rule before conversation-level risk.
   */
  { resourcesDue = atLeast(level, "ELEVATED") }: { resourcesDue?: boolean } = {},
): Action {
  if (atLeast(level, "CRISIS")) return "escalate";
  if (r.enables_harm >= 0.1) return "replace";
  if (atLeast(level, "WATCH") && r.dismisses_risk >= 0.3) return "replace";
  if (atLeast(level, "ELEVATED") && resourcesDue && r.offers_support_resources < 0.5) return "replace";
  if (r.clinical_overreach >= 0.5) return "replace";
  return "send";
}

/**
 * What to do when a check couldn't run in time. Fail closed: a draft is never sent unchecked.
 * The sticky level is still known without Jev, so a conversation already in crisis still escalates.
 */
export function failClosedAction(level: RiskLevel): Action {
  return atLeast(level, "CRISIS") ? "escalate" : "replace";
}
