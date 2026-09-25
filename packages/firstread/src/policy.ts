/**
 * Turns Jev probabilities into a risk level and an action for the draft reply.
 *
 * Pure functions, no API calls, so they are easy to unit test and tune.
 *
 * All thresholds are placeholders: tune them on evals/ before trusting them.
 * They are deliberately low, because missing a real crisis costs far more than
 * a false alarm.
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

/** Risk level for a single user turn, from yes/no probabilities. */
export function assessLevel(p: UserSignals): RiskLevel {
  if (p.intent >= 0.2 || p.imminent >= 0.2 || (p.plan >= 0.3 && p.means >= 0.3)) {
    return "CRISIS";
  }
  if (p.plan >= 0.2 || p.self_harm >= 0.3 || p.ideation >= 0.4 || p.harm_to_others >= 0.4) {
    return "ELEVATED";
  }
  // Weak signals that add up, confirmed by a follow-up. Follow-ups can only raise the level.
  if (noisyOr(p) >= BORDERLINE_SCORE && FOLLOW_UPS.some((key) => p[key] >= FOLLOW_UP_CONFIRMS)) {
    return "ELEVATED";
  }
  if (p.ideation >= 0.15 || p.self_harm >= 0.15 || p.harm_to_others >= 0.2) {
    return "WATCH";
  }
  // counselor_concern is too broad to escalate on (depression, grief, addiction), so only watch.
  if (noisyOr(p) >= BORDERLINE_SCORE && p.counselor_concern >= FOLLOW_UP_CONFIRMS) {
    return "WATCH";
  }
  return "NONE";
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
export function decideAction(level: RiskLevel, r: ReplySignals): Action {
  if (atLeast(level, "CRISIS")) return "escalate";
  if (r.enables_harm >= 0.1) return "replace";
  if (atLeast(level, "WATCH") && r.dismisses_risk >= 0.3) return "replace";
  if (atLeast(level, "ELEVATED") && r.offers_support_resources < 0.5) return "replace";
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
