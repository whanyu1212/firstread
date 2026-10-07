/**
 * Conversation-level risk (HY-154): each turn's check is evidence, and the conversation's level is
 * a state that rises fast, falls slowly, and only comes down from CRISIS when a person decides.
 *
 * updateRisk() is pure: no API calls, no storage. The live guard, the evals and the offline sweeps
 * all run this same code, and any conversation can be replayed change by change.
 *
 * 1. Ledger: user messages that raised concern are kept, and shown to Jev once they've scrolled
 *    out of its window (guard.ts), so early hints aren't lost.
 * 2. Evidence-backed CRISIS: the intent and preparation rules stand alone. The imminence and
 *    plan-plus-means rules also need self-harm context (ideation, self-harm, or an already raised
 *    conversation) and the latest message adding something; without both the turn stops at
 *    ELEVATED. One noisy reading, or an echo of an earlier message, can't make CRISIS.
 *
 * Jev reads each message in the context of the conversation, so after a disclosure most signals
 * stay high on calm turns. `latest_adds_risk` isolates what the latest message itself adds: it
 * decides what counts as calm, what builds the score, what goes in the ledger, and whether an
 * echo may raise the level again. First-time rises are never held back by it.
 * 3. Building score: weak evidence adds up across turns and fades, and can raise the level to
 *    WATCH or ELEVATED (never CRISIS).
 * 4. Support lines are due when a signal is new or recent, then as periodic check-ins, not in every
 *    reply forever (resourcesDue).
 * 5. ELEVATED settles to WATCH after several calm turns. Never to NONE. CRISIS only comes down
 *    through clearCrisis(), a person's decision.
 */

import { type RiskLevel, type CrisisRoute, assessLevel, atLeast, crisisRoutes, rank } from "./policy";
import type { UserSignals } from "./questions";

export interface RiskConfig {
  /** Self-harm context for the imminent and plan_means CRISIS routes. */
  contextIdeation: number;
  contextSelfHarm: number;
  /** Evidence below this is background noise and doesn't build the score. */
  evidenceFloor: number;
  /** How much of the score carries to the next turn. */
  decay: number;
  scoreWatch: number;
  scoreElevated: number;
  /** latest_adds_risk below this is a calm turn: the message adds nothing new. */
  calmEvidence: number;
  /** The imminent and plan_means CRISIS rules also need latest_adds_risk at or above this. */
  acuteAdds: number;
  /** ELEVATED settles to WATCH after this many calm turns in a row. */
  settleAfter: number;
  /** Support lines are due on a turn with a signal, and this many user turns after one. */
  resourcesRecent: number;
  /** ...and as a check-in this often at ELEVATED, counted in user turns. */
  resourcesEvery: number;
  ledgerMax: number;
  excerptMax: number;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  contextIdeation: 0.3,
  contextSelfHarm: 0.3,
  evidenceFloor: 0.2,
  decay: 0.6,
  // Both above what one message can add (1 - evidenceFloor = 0.8), so the score only raises the
  // level when evidence comes from more than one turn. At 0.5, single distressed posts reached
  // WATCH: BHH test no_crisis at WATCH went 15.3% -> 24.3% on the same signals, with no gain on dev.
  scoreWatch: 0.9,
  scoreElevated: 1.0,
  calmEvidence: 0.15,
  acuteAdds: 0.2,
  settleAfter: 4,
  resourcesRecent: 1,
  resourcesEvery: 3,
  ledgerMax: 10,
  excerptMax: 200,
};

export interface LedgerEntry {
  /** Index of the user message in the conversation's turns. */
  turn: number;
  text: string;
  level: RiskLevel;
}

export interface RiskChange {
  /** User-turn number, from 1. */
  turn: number;
  from: RiskLevel;
  to: RiskLevel;
  reason: string;
}

export interface RiskState {
  level: RiskLevel;
  /** Highest level ever reached. */
  peak: RiskLevel;
  /** Weak evidence that builds up and fades (a policy measure, not a probability). */
  score: number;
  /** User turns so far. */
  turns: number;
  /** User turn of the last signal at WATCH or above. */
  lastSignalTurn: number | null;
  /** User turn when the user was last given support lines. */
  lastResourcesTurn: number | null;
  calmTurns: number;
  ledger: LedgerEntry[];
  changes: RiskChange[];
  /** Level and score after each user turn, for the risk panel's timeline. */
  history: { turn: number; level: RiskLevel; score: number }[];
  clearedBy?: { reviewer: string; at: string };
  /** Increases with every update, so a stale copy can be told apart from a newer one. */
  version: number;
}

const HISTORY_MAX = 200;

export function initialRisk(): RiskState {
  return {
    level: "NONE",
    peak: "NONE",
    score: 0,
    turns: 0,
    lastSignalTurn: null,
    lastResourcesTurn: null,
    calmTurns: 0,
    ledger: [],
    changes: [],
    history: [],
    version: 0,
  };
}

const max = (a: RiskLevel, b: RiskLevel): RiskLevel => (rank(a) >= rank(b) ? a : b);
const SELF_STANDING: CrisisRoute[] = ["intent", "preparation"];

/** This turn's own reading, after the CRISIS context rule (part 2), with the reason. */
function reading(
  p: UserSignals,
  prev: RiskState,
  config: RiskConfig,
): { level: RiskLevel; reason: string } {
  const base = assessLevel(p);
  if (base !== "CRISIS") return { level: base, reason: `this message read as ${base}` };
  const routes = crisisRoutes(p);
  if (routes.some((r) => SELF_STANDING.includes(r))) {
    return { level: "CRISIS", reason: `${routes.join(" + ")} signal` };
  }
  const context =
    p.ideation >= config.contextIdeation ||
    p.self_harm >= config.contextSelfHarm ||
    atLeast(prev.level, "ELEVATED");
  if (!context) {
    return { level: "ELEVATED", reason: `${routes.join(" + ")} signal without self-harm context, held at ELEVATED` };
  }
  if (p.latest_adds_risk < config.acuteAdds) {
    return { level: "ELEVATED", reason: `${routes.join(" + ")} signal echoing earlier messages, held at ELEVATED` };
  }
  return { level: "CRISIS", reason: `${routes.join(" + ")} signal with self-harm context` };
}

/**
 * The next risk state after a user turn. `turn` is the index of the user message in the
 * conversation's turns (for the ledger); `text` is the message.
 */
export function updateRisk(
  prev: RiskState,
  p: UserSignals,
  { turn, text }: { turn: number; text: string },
  config: RiskConfig = DEFAULT_RISK_CONFIG,
): RiskState {
  const userTurn = prev.turns + 1;
  const now = reading(p, prev, config);

  // What this message adds, as opposed to what the conversation already holds.
  const adds = p.latest_adds_risk;
  const calm = adds < config.calmEvidence;
  const calmTurns = calm ? prev.calmTurns + 1 : 0;
  // A real new signal: the reading is WATCH or above and the message itself adds something.
  const signal = atLeast(now.level, "WATCH") && !calm;

  // Part 3: what each message adds builds up and fades, so an old message isn't counted again.
  const evidence = Math.max(0, adds - config.evidenceFloor);
  const score = config.decay * prev.score + evidence;
  const fromScore: RiskLevel =
    score >= config.scoreElevated ? "ELEVATED" : score >= config.scoreWatch ? "WATCH" : "NONE";

  let level = prev.level;
  const changes = [...prev.changes];
  const change = (to: RiskLevel, reason: string) => {
    changes.push({ turn: userTurn, from: level, to, reason });
    level = to;
  };

  // On a calm turn, a reading no higher than the conversation has already reached is an echo of an
  // earlier message: it mustn't lift a settled conversation back up. A first-time rise always counts.
  const echo = calm && rank(now.level) <= rank(prev.peak);
  const target = max(echo ? "NONE" : now.level, fromScore);
  if (rank(target) > rank(level)) {
    change(target, now.level === target ? now.reason : `evidence building across turns (score ${score.toFixed(2)})`);
  } else if (level === "ELEVATED" && calmTurns >= config.settleAfter && score < config.scoreElevated) {
    // Part 5: ELEVATED settles to WATCH after calm turns. Never further; CRISIS never on its own.
    change("WATCH", `${calmTurns} calm turns with no new signal`);
  }

  // Part 1: keep messages that raised concern, for Jev once they leave its window.
  const ledger = signal
    ? [...prev.ledger, { turn, text: text.slice(0, config.excerptMax), level: now.level }].slice(-config.ledgerMax)
    : prev.ledger;

  return {
    ...prev,
    level,
    peak: max(prev.peak, level),
    score,
    turns: userTurn,
    lastSignalTurn: signal ? userTurn : prev.lastSignalTurn,
    calmTurns,
    ledger,
    changes,
    history: [...prev.history, { turn: userTurn, level, score }].slice(-HISTORY_MAX),
    version: prev.version + 1,
  };
}

/**
 * Part 4: whether this turn's reply must point to support. At ELEVATED: when a signal is new or
 * recent, and as a periodic check-in; not in every reply forever. At CRISIS the crisis reply has
 * them anyway. Call after updateRisk() for the turn.
 */
export function resourcesDue(state: RiskState, config: RiskConfig = DEFAULT_RISK_CONFIG): boolean {
  if (!atLeast(state.level, "ELEVATED")) return false;
  const recent = state.lastSignalTurn !== null && state.turns - state.lastSignalTurn <= config.resourcesRecent;
  const checkIn = state.lastResourcesTurn === null || state.turns - state.lastResourcesTurn >= config.resourcesEvery;
  return recent || checkIn;
}

/** Record that this turn's reply gave the user support lines. */
export function resourcesGiven(state: RiskState): RiskState {
  return { ...state, lastResourcesTurn: state.turns, version: state.version + 1 };
}

/** Raise the level directly (e.g. a recheck after a failed turn). Never lowers it. */
export function raiseRisk(state: RiskState, to: RiskLevel, reason: string): RiskState {
  if (rank(to) <= rank(state.level)) return state;
  return {
    ...state,
    level: to,
    peak: max(state.peak, to),
    changes: [...state.changes, { turn: state.turns, from: state.level, to, reason }],
    version: state.version + 1,
  };
}

/** A turn recorded without a check (a conversation already at CRISIS): history only. */
export function noteTurn(state: RiskState): RiskState {
  const turns = state.turns + 1;
  return {
    ...state,
    turns,
    history: [...state.history, { turn: turns, level: state.level, score: state.score }].slice(-HISTORY_MAX),
    version: state.version + 1,
  };
}

/**
 * A person clears CRISIS (HY-20). The level comes down to ELEVATED, not lower: the conversation
 * still needs care, and it can settle further on its own.
 */
export function clearCrisis(state: RiskState, reviewer: string, at = new Date().toISOString()): RiskState {
  if (state.level !== "CRISIS") return state;
  return {
    ...state,
    level: "ELEVATED",
    calmTurns: 0,
    clearedBy: { reviewer, at },
    changes: [...state.changes, { turn: state.turns, from: "CRISIS", to: "ELEVATED", reason: `cleared by ${reviewer}` }],
    version: state.version + 1,
  };
}

/** Ledger entries Jev can no longer see: older than the window of recent turns it's shown. */
export function ledgerOutsideWindow(state: RiskState, turnCount: number, window: number): LedgerEntry[] {
  return state.ledger.filter((e) => e.turn < turnCount - window);
}
