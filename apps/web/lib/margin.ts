import type { FailureReason } from "firstread";
import { type LevelAnswer, atLeast, levelEvidence, rank } from "firstread/policy";
import type { ChatData } from "./chat";

/** The words in the demo margin's turn notes (components/Margin.tsx), kept apart so they're tested. */

/** A probability as the margin shows it. */
export const pct = (v: number) => `${Math.round(v * 100)}%`;

/** How a Jev call failed, said plainly: an outage isn't a slow answer. */
const FAILED: Record<FailureReason, string> = {
  timeout: "didn't answer in time",
  rate_limited: "was rate-limited",
  unavailable: "couldn't be reached",
  error: "returned an error",
};
const failure = (audit: ChatData["audit"], check: "user" | "reply") =>
  FAILED[audit.failures.find((f) => f.check === check)?.reason ?? "timeout"];

/**
 * Why this turn reads as it does: the answers in this message that set its reading
 * (policy.ts levelEvidence, the same rules as the level), or, when there are none, a sentence.
 */
export function why(
  risk: ChatData["risk"],
  audit: ChatData["audit"],
  reason: string | null,
): { answers: LevelAnswer[]; combined: number | null; note: string | null } {
  if (audit.shortCircuit === "already-crisis") {
    return { answers: [], combined: null, note: "No checks this turn: the conversation is already at CRISIS, so the crisis reply went out at once." };
  }
  if (!audit.userSignals) {
    return { answers: [], combined: null, note: `Jev ${failure(audit, "user")}, so this message wasn't read.` };
  }
  const reading = levelEvidence(audit.userSignals);
  // The conversation's level can differ from this message's own reading: held below CRISIS without
  // self-harm context, raised by evidence across turns, kept from earlier, or not raised again by an
  // echo. A change this turn has its reason; otherwise say which way it differs.
  const carried =
    rank(risk.level) > rank(reading.level)
      ? `This message alone reads as ${reading.level}. FirstRead keeps ${risk.level} from earlier messages.`
      : `This message reads as ${reading.level}, but it echoes earlier messages, so the level stays ${risk.level}.`;
  const differs = reading.level !== risk.level;
  if (reading.answers.length > 0) {
    return { answers: reading.answers, combined: reading.combined, note: differs ? (reason ?? carried) : null };
  }
  if (risk.level === "NONE") return { answers: [], combined: null, note: "Jev saw no sign of risk in this message." };
  return {
    answers: [],
    combined: null,
    note: reason ?? "Nothing new in this message. FirstRead keeps the level from earlier messages.",
  };
}

/**
 * What happened to the companion's draft, when it wasn't sent as written. Mirrors decideAction's
 * order (policy.ts). Whether support lines were due isn't in the page's data: a replacement at
 * ELEVATED whose only finding is missing support means they were due, but when the draft also gave
 * clinical advice either could be the cause, so both are named.
 */
export function draftChange(audit: ChatData["audit"]): string | null {
  if (audit.shortCircuit === "crisis") return "The companion was stopped and the crisis reply went out.";
  if (audit.shortCircuit === "already-crisis") return null;
  if (audit.failures.length > 0 && audit.action !== "escalate") {
    const check = audit.failures.some((f) => f.check === "user") ? "user" : "reply";
    const which = check === "user" ? "the check on this message" : "the check on the draft";
    return `Jev ${failure(audit, check)} for ${which}, so the companion's reply was held back and a cautious one went out.`;
  }
  if (audit.action === "escalate") return "The crisis reply went out instead of the companion's draft.";
  if (audit.action !== "replace" || !audit.replySignals) return null;
  const r = audit.replySignals;
  if (r.enables_harm >= 0.1) return `The draft could have enabled harm (${pct(r.enables_harm)}), so a safe reply went out instead.`;
  if (atLeast(audit.level, "WATCH") && r.dismisses_risk >= 0.3) {
    return `The draft moved past the distress (${pct(r.dismisses_risk)}), so a reply that acknowledges it went out instead.`;
  }
  if (atLeast(audit.level, "ELEVATED") && r.offers_support_resources < 0.5) {
    return r.clinical_overreach >= 0.5
      ? `The draft gave clinical advice (${pct(r.clinical_overreach)}) and didn't point to support, so a safe reply went out instead.`
      : "The draft didn't point to support, so a reply that does went out instead.";
  }
  if (r.clinical_overreach >= 0.5) return `The draft gave clinical advice (${pct(r.clinical_overreach)}), so a safe reply went out instead.`;
  return "The companion's draft was replaced with a safe reply.";
}

