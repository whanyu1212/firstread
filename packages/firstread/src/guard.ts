/**
 * The FirstRead guard: two Jev calls per turn.
 *
 *     user message --+--> user check ---------------------------------+
 *                    |                                               +--> send | replace | escalate
 *                    +--> companion LLM --> draft --> reply check ---+
 *
 * startTurn() kicks off the user check as soon as the message arrives, so it runs while the
 * companion writes its draft. finish(draft) adds the reply check and decides.
 *
 * Live turns have a deadline and fail closed: both checks must answer within `deadlineMs` of the
 * draft being ready, or the draft is not sent. checkUser(), checkReply() and recheck() are the
 * patient path for evals and background jobs: default SDK retries, no deadline, errors thrown.
 */

import { type FailureReason, type JevClient, type NoulQuestion, createJevClient, failureReason } from "./jev";
import {
  type Action,
  type RiskLevel,
  assessLevel,
  atLeast,
  decideAction,
  escalate,
  failClosedAction,
} from "./policy";
import {
  REPLY_QUESTIONS,
  type ReplySignals,
  USER_TURN_QUESTIONS,
  type UserSignals,
} from "./questions";
import { DEFAULT_REPLIES, type Replies } from "./templates";

export type Role = "user" | "assistant";
export type Turn = { role: Role; text: string };

export class Conversation {
  turns: Turn[] = [];
  level: RiskLevel = "NONE";

  add(role: Role, text: string): void {
    this.turns.push({ role, text });
  }
}

export type Check = "user" | "reply";
export type CheckFailure = { check: Check; reason: FailureReason };

export interface TurnAudit {
  /** Index of this turn's user message in conv.turns; pass it to recheck() after a failure. */
  turn: number;
  level: RiskLevel;
  action: Action;
  /** null when that check failed; see `failures`. */
  userSignals: UserSignals | null;
  replySignals: ReplySignals | null;
  /** Checks that didn't answer in time. Non-empty means the turn failed closed. */
  failures: CheckFailure[];
  draft: string;
  /** What actually goes to the user. */
  reply: string;
}

/** The user check's result, before the turn is recorded. `level` includes the conversation's level. */
export type UserCheck =
  | { ok: true; level: RiskLevel; signals: UserSignals }
  | { ok: false; reason: FailureReason };

export interface PendingTurn {
  /**
   * The user check as soon as it answers, without changing the conversation. Lets the caller act
   * early, e.g. stop drafting when it says CRISIS. Never rejects.
   */
  user: Promise<UserCheck>;
  /** Run the reply check on the draft, decide, and record the turn. */
  finish(draft: string): Promise<TurnAudit>;
  /**
   * Record the turn without a draft: the user check's level still applies, and the user gets the
   * reply that level calls for (the crisis reply at CRISIS, otherwise the fail-closed fallback).
   * For when drafting was stopped or failed. Never sends anything unchecked.
   */
  finishWithoutDraft(): Promise<TurnAudit>;
}

export interface FirstReadOptions {
  /** Any JevClient; tests pass a fake. Defaults to Jev via TypeSafe's SDK. */
  client?: JevClient;
  /** How many recent turns Jev sees, so risk that builds across turns is not judged one message at a time. */
  window?: number;
  /** Live turns: how long both checks may take once the draft is ready, retries included. */
  deadlineMs?: number;
  /** Replies sent instead of a draft. Defaults are US-centric; use `repliesFor(country)` to localise. */
  replies?: Partial<Replies>;
}

type Outcome<T> = { ok: true; signals: T } | { ok: false; reason: FailureReason };

function replyFor(action: Action, draft: string, replies: Replies): string {
  if (action === "escalate") return replies.crisis;
  if (action === "replace") return replies.safe;
  return draft;
}

/** Fail-closed reply: as gentle as the known risk level allows. */
function fallbackReply(level: RiskLevel, replies: Replies): string {
  if (atLeast(level, "CRISIS")) return replies.crisis;
  if (atLeast(level, "ELEVATED")) return replies.safe;
  return replies.holding;
}

export class FirstRead {
  private readonly client: JevClient;
  private readonly window: number;
  private readonly deadlineMs: number;
  private readonly replies: Replies;

  constructor({ client, window = 8, deadlineMs = 3_000, replies }: FirstReadOptions = {}) {
    this.client = client ?? createJevClient();
    this.window = window;
    this.deadlineMs = deadlineMs;
    this.replies = { ...DEFAULT_REPLIES, ...replies };
  }

  /**
   * Start a live turn: the user check begins now, while you generate the draft.
   * One turn at a time per conversation; don't change `conv` until finish() returns.
   */
  startTurn(conv: Conversation, userMsg: string): PendingTurn {
    const abort = new AbortController();
    const userOutcome = this.live(this.userState(conv.turns, userMsg), USER_TURN_QUESTIONS, abort);
    const user = userOutcome.then(
      (u): UserCheck =>
        u.ok ? { ok: true, level: escalate(conv.level, assessLevel(u.signals)), signals: u.signals } : u,
    );
    return {
      user,
      finish: (draft) => this.finish(conv, userMsg, draft, userOutcome, abort),
      finishWithoutDraft: () => this.finishWithoutDraft(conv, userMsg, userOutcome),
    };
  }

  /**
   * A turn in a conversation already at CRISIS: the level can't go higher and only a reviewer can
   * lower it, so every turn escalates. No checks run; the crisis reply goes out at once.
   */
  crisisTurn(conv: Conversation, userMsg: string): TurnAudit {
    if (conv.level !== "CRISIS") throw new Error("crisisTurn is only for conversations at CRISIS");
    const turn = conv.turns.length;
    conv.add("user", userMsg);
    conv.add("assistant", this.replies.crisis);
    return {
      turn,
      level: conv.level,
      action: "escalate",
      userSignals: null,
      replySignals: null,
      failures: [],
      draft: "",
      reply: this.replies.crisis,
    };
  }

  /** A live turn when the draft is already written. */
  audit(conv: Conversation, userMsg: string, draft: string): Promise<TurnAudit> {
    return this.startTurn(conv, userMsg).finish(draft);
  }

  async checkUser(
    conv: Conversation,
    userMsg: string,
  ): Promise<{ level: RiskLevel; signals: UserSignals }> {
    const signals = await this.client.ask(this.userState(conv.turns, userMsg), USER_TURN_QUESTIONS, {
      patient: true,
    });
    conv.level = escalate(conv.level, assessLevel(signals));
    return { level: conv.level, signals };
  }

  async checkReply(
    conv: Conversation,
    userMsg: string,
    draft: string,
  ): Promise<{ action: Action; signals: ReplySignals }> {
    const signals = await this.client.ask(this.replyState(conv.turns, userMsg, draft), REPLY_QUESTIONS, {
      patient: true,
    });
    return { action: decideAction(conv.level, signals), signals };
  }

  /**
   * Re-run the user check for a turn that failed closed, e.g. from a background job.
   * Raises the conversation's level if the message was risky; alert a reviewer when `raised`.
   */
  async recheck(
    conv: Conversation,
    turn: number,
  ): Promise<{ level: RiskLevel; signals: UserSignals; raised: boolean }> {
    const msg = conv.turns[turn];
    if (msg?.role !== "user") throw new Error(`turn ${turn} is not a user message`);
    const state = this.userState(conv.turns.slice(0, turn), msg.text);
    const signals = await this.client.ask(state, USER_TURN_QUESTIONS, { patient: true });
    const before = conv.level;
    conv.level = escalate(conv.level, assessLevel(signals));
    return { level: conv.level, signals, raised: conv.level !== before };
  }

  private async finish(
    conv: Conversation,
    userMsg: string,
    draft: string,
    userCheck: Promise<Outcome<UserSignals>>,
    abort: AbortController,
  ): Promise<TurnAudit> {
    const replyCheck = this.live(this.replyState(conv.turns, userMsg, draft), REPLY_QUESTIONS, abort);
    const timer = setTimeout(() => abort.abort(), this.deadlineMs);
    const [user, reply] = await Promise.all([userCheck, replyCheck]).finally(() => clearTimeout(timer));

    if (user.ok) conv.level = escalate(conv.level, assessLevel(user.signals));
    const failures: CheckFailure[] = [];
    if (!user.ok) failures.push({ check: "user", reason: user.reason });
    if (!reply.ok) failures.push({ check: "reply", reason: reply.reason });

    const action =
      user.ok && reply.ok ? decideAction(conv.level, reply.signals) : failClosedAction(conv.level);
    const sent = failures.length > 0 ? fallbackReply(conv.level, this.replies) : replyFor(action, draft, this.replies);

    const turn = conv.turns.length;
    conv.add("user", userMsg);
    conv.add("assistant", sent);
    return {
      turn,
      level: conv.level,
      action,
      userSignals: user.ok ? user.signals : null,
      replySignals: reply.ok ? reply.signals : null,
      failures,
      draft,
      reply: sent,
    };
  }

  private async finishWithoutDraft(
    conv: Conversation,
    userMsg: string,
    userCheck: Promise<Outcome<UserSignals>>,
  ): Promise<TurnAudit> {
    const user = await userCheck;
    if (user.ok) conv.level = escalate(conv.level, assessLevel(user.signals));
    const failures: CheckFailure[] = user.ok ? [] : [{ check: "user", reason: user.reason }];
    const action = failClosedAction(conv.level);
    const sent = fallbackReply(conv.level, this.replies);

    const turn = conv.turns.length;
    conv.add("user", userMsg);
    conv.add("assistant", sent);
    return {
      turn,
      level: conv.level,
      action,
      userSignals: user.ok ? user.signals : null,
      replySignals: null,
      failures,
      draft: "",
      reply: sent,
    };
  }

  /** One live Jev call. Never rejects: failures and aborts become an Outcome. */
  private live<K extends string>(
    state: string,
    questions: Record<K, NoulQuestion>,
    abort: AbortController,
  ): Promise<Outcome<Record<K, number>>> {
    const call = this.client.ask(state, questions, { signal: abort.signal }).then(
      (signals): Outcome<Record<K, number>> => ({ ok: true, signals }),
      (err): Outcome<Record<K, number>> => ({ ok: false, reason: failureReason(err) }),
    );
    // Don't rely on the client honouring the signal: stop waiting as soon as the deadline hits.
    const deadline = new Promise<Outcome<Record<K, number>>>((resolve) => {
      abort.signal.addEventListener("abort", () => resolve({ ok: false, reason: "timeout" }), { once: true });
    });
    return Promise.race([call, deadline]);
  }

  private userState(turns: Turn[], userMsg: string): string {
    return `${this.transcript(turns)}\n\nLATEST USER MESSAGE:\n${userMsg}`;
  }

  private replyState(turns: Turn[], userMsg: string, draft: string): string {
    return `${this.userState(turns, userMsg)}\n\nDRAFT ASSISTANT REPLY:\n${draft}`;
  }

  private transcript(turns: Turn[]): string {
    const recent = turns.slice(-this.window);
    if (recent.length === 0) return "CONVERSATION SO FAR: (none)";
    const lines = recent.map(({ role, text }) => `${role.toUpperCase()}: ${text}`);
    return `CONVERSATION SO FAR:\n${lines.join("\n")}`;
  }
}
