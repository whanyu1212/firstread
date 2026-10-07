/**
 * One turn of the demo: FirstRead guards the companion agent.
 *
 *     message --+--> user check (Jev, ~0.6s) --> CRISIS? --> stop the agent, send the crisis reply
 *               +--> companion: one call --> draft --> reply check --> send | replace | escalate
 *
 * - Already at CRISIS: the crisis reply goes out at once; nothing else runs.
 * - The agent failing or being stopped never means sending something unchecked: the turn is
 *   recorded through FirstRead with the reply its level calls for.
 * - The runtime, not the agent, records handoffs, from FirstRead's signals.
 *
 * Dependencies are passed in so tests can use a fake Jev client and a fake companion.
 */

import { type FirstRead, type TurnAudit, type UserCheck, atLeast } from "firstread";
import type { Draft } from "./companion";
import { type Handoff, type Note, type Session, fromConversation, toConversation } from "./session";
import { EXERCISES, type Exercise } from "./skills/exercises";

/** asks_for_person at or above this records a handoff request. */
export const ASKS_FOR_PERSON = 0.5;

/**
 * The companion gets this long, then it's stopped and the turn goes out through FirstRead's fallback.
 * Keeps a stuck model call well inside the route's 60s limit.
 */
export const DRAFT_TIMEOUT_MS = 20_000;

export class DraftTimeoutError extends Error {
  constructor(ms: number) {
    super(`companion didn't answer within ${ms}ms`);
    this.name = "DraftTimeoutError";
  }
}

export interface TurnDeps {
  guard: Pick<FirstRead, "startTurn" | "crisisTurn">;
  draft: (input: { history: Session["conv"]["turns"]; text: string; notes: Note[]; signal: AbortSignal }) => Promise<Draft>;
  now?: () => number;
  draftTimeoutMs?: number;
}

export interface TurnResult {
  audit: TurnAudit;
  /** Shown only when the companion's own reply went out unchanged. */
  exercise: Exercise | null;
  handoff: Handoff | null;
  /** Why the agent didn't run to completion, if it didn't. */
  shortCircuit: "already-crisis" | "crisis" | null;
  /** The companion failed (not stopped by us); the turn went out through FirstRead's fallback. */
  draftError: unknown;
  timings: { checkMs: number | null; draftMs: number | null; totalMs: number };
}

export async function runTurn(
  text: string,
  session: Session,
  deps: TurnDeps,
  onCheck?: (check: UserCheck, ms: number) => void,
): Promise<TurnResult> {
  const now = deps.now ?? (() => performance.now());
  const started = now();
  const conv = toConversation(session.conv);
  const levelBefore = conv.level;
  const timings: TurnResult["timings"] = { checkMs: null, draftMs: null, totalMs: 0 };

  let audit: TurnAudit;
  let draft: Draft | null = null;
  let draftError: unknown = null;
  let shortCircuit: TurnResult["shortCircuit"] = null;

  if (conv.level === "CRISIS") {
    audit = deps.guard.crisisTurn(conv, text);
    shortCircuit = "already-crisis";
  } else {
    const pending = deps.guard.startTurn(conv, text);
    const agent = new AbortController();
    const draftTimeoutMs = deps.draftTimeoutMs ?? DRAFT_TIMEOUT_MS;
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      agent.abort();
    }, draftTimeoutMs);

    // Neither promise rejects: the loser of the race below settles later, and an unhandled
    // rejection would take the process down.
    const drafted = deps
      .draft({ history: conv.turns.map((t) => ({ ...t })), text, notes: session.notes, signal: agent.signal })
      .then(
        (d) => ({ ok: true as const, draft: d }),
        (error: unknown) => ({ ok: false as const, error }),
      )
      .finally(() => {
        clearTimeout(deadline);
        timings.draftMs = now() - started;
      });
    const checked = pending.user.then((user) => {
      timings.checkMs = now() - started;
      onCheck?.(user, timings.checkMs);
      // CRISIS replaces whatever the agent writes, so stop it now.
      if (user.ok && user.level === "CRISIS") agent.abort();
      return user;
    });

    const first = await Promise.race([
      checked.then((user) => ({ kind: "user" as const, user })),
      drafted.then((result) => ({ kind: "draft" as const, result })),
    ]);

    if (first.kind === "user" && first.user.ok && first.user.level === "CRISIS") {
      audit = await pending.finishWithoutDraft();
      shortCircuit = "crisis";
    } else {
      const result = await drafted;
      if (result.ok) {
        draft = result.draft;
        // If the user check says CRISIS after this, finish() escalates anyway.
        audit = await pending.finish(draft.reply);
      } else {
        // Stopped by us (CRISIS arrived mid-draft, or too slow) or failed: either way, nothing
        // unchecked goes out.
        if (timedOut) draftError = new DraftTimeoutError(draftTimeoutMs);
        else if (!agent.signal.aborted) draftError = result.error;
        else shortCircuit = "crisis";
        audit = await pending.finishWithoutDraft();
      }
    }
  }

  const exercise =
    draft?.exercise && audit.action === "send" && audit.failures.length === 0 ? EXERCISES[draft.exercise] : null;

  let handoff: Handoff | null = null;
  const at = new Date().toISOString();
  if (atLeast(audit.level, "CRISIS") && !atLeast(levelBefore, "CRISIS")) {
    handoff = { reason: "FirstRead escalated the conversation to CRISIS", at };
  } else if ((audit.userSignals?.asks_for_person ?? 0) >= ASKS_FOR_PERSON) {
    handoff = { reason: "The person asked to talk to a real person", at };
  }
  if (handoff) session.handoffs.push(handoff);

  session.conv = fromConversation(conv);
  timings.totalMs = now() - started;
  return { audit, exercise, handoff, shortCircuit, draftError, timings };
}
