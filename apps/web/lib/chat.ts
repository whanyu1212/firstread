import type { UIMessage } from "ai";
import type { Action, CheckFailure, ReplySignals, RiskChange, RiskLevel, UserSignals } from "firstread";

/**
 * Header carrying the visitor's own OpenAI key (HY-153). The server uses it for that request only
 * and never stores or logs it. Local development falls back to OPENAI_API_KEY in .env.
 */
export const OPENAI_KEY_HEADER = "x-openai-key";

/** Demo switch: "1" makes every Jev check fail for this request, to show fail-closed. */
export const JEV_DOWN_HEADER = "x-demo-jev-down";

/** Longest message the route accepts. */
export const MAX_MESSAGE_LENGTH = 2000;

/** Data parts the chat route sends alongside the reply, for the risk panel (HY-19). */
export type ChatData = {
  /** The companion's original draft in an opt-in synthetic recording. Never sent by live chat. */
  recordedDraft: { text: string };
  /** The user check, as soon as it answers, while the companion is still working. */
  check: { ok: true; level: RiskLevel; ms: number } | { ok: false; reason: string; ms: number };
  /** What FirstRead decided for the turn. */
  audit: {
    level: RiskLevel;
    action: Action;
    failures: CheckFailure[];
    userSignals: UserSignals | null;
    replySignals: ReplySignals | null;
    shortCircuit: "already-crisis" | "crisis" | null;
  };
  /** An exercise the companion offered; the page shows the steps. */
  exercise: { id: string; name: string; steps: string[] };
  /** The runtime recorded a request for a person (simulated in the demo). */
  handoff: { reason: string };
  /** The companion failed; the user got FirstRead's fallback reply instead. */
  companionError: { message: string };
  /**
   * draftMs: when the companion's call ended, draft or not. replyCheckMs: set only when a draft was
   * checked (absent in recordings made before it existed).
   */
  timing: { model: string; checkMs: number | null; draftMs: number | null; replyCheckMs?: number | null; totalMs: number };
  /**
   * The conversation's risk state after this turn, for the risk panel (HY-19). A presenter or
   * reviewer view, never a score shown to the person chatting. `score` is risk evidence, a policy
   * measure, not a probability.
   */
  risk: {
    level: RiskLevel;
    peak: RiskLevel;
    score: number;
    history: { turn: number; level: RiskLevel; score: number }[];
    changes: RiskChange[];
    /** Earlier messages FirstRead is still carrying forward. */
    ledger: { text: string; level: RiskLevel }[];
    /** Where the score raises the level on its own. */
    thresholds: { watch: number; elevated: number };
  };
};

export type ChatMessage = UIMessage<never, ChatData>;
