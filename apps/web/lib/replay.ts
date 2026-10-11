import type { ChatData, ChatMessage } from "./chat";

/**
 * A conversation recorded through the real turn pipeline (scripts/record-replay.ts): per turn, the
 * user's message, the reply that went out, and the data parts the page received. Turned back into
 * chat messages, it renders with the same components as a live chat (the deck's replay, HY-159;
 * the demo's keyless replays, HY-166).
 */
export type RecordedTurn = { user: string; reply: string; draft?: string; data: Partial<ChatData> };
export type Recording = { scenario: string; title: string; recordedAt: string; turns: RecordedTurn[] };

/** How far a replay has got: the latest turn shown, and how much of it. */
export type ReplayPhase = "user" | "checked" | "done";
export type Shown = { turn: number; phase: ReplayPhase };
export type ReplayStep = Shown & { at: number };

/** Time to read each reply before the next message arrives, in recorded time. */
export const REPLAY_PAUSE_MS = 1800;

/**
 * When each moment of a recording happens, in ms from the start, at its recorded timings: the
 * message, FirstRead's read once the user check answered, then the reply once it went out.
 */
export function replaySchedule(rec: Recording, { startMs = 400, pauseMs = REPLAY_PAUSE_MS } = {}): ReplayStep[] {
  const steps: ReplayStep[] = [];
  let at = startMs;
  rec.turns.forEach((t, turn) => {
    const { checkMs, totalMs } = t.data.timing!;
    const total = Math.max(totalMs, 250);
    steps.push({ at, turn, phase: "user" });
    if (checkMs !== null && checkMs < totalMs) steps.push({ at: at + checkMs, turn, phase: "checked" });
    steps.push({ at: at + total, turn, phase: "done" });
    at += total + pauseMs;
  });
  return steps;
}

export const finalStep = (rec: Recording): Shown => ({ turn: rec.turns.length - 1, phase: "done" });

/**
 * `play` keeps message ids apart between plays of the same recording, so nothing keyed by id
 * (React keys, when a message was sent) carries over from the last play.
 */
export function userMessage(turn: RecordedTurn, i: number, play = ""): ChatMessage {
  return { id: `user-${play}${i}`, role: "user", parts: [{ type: "text", text: turn.user }] };
}

/**
 * The reply as the page held it at one moment of the turn: `"checked"` once the user check has
 * answered (only its part), `"done"` once the reply is in (everything).
 */
export function replyMessage(turn: RecordedTurn, i: number, phase: "checked" | "done", play = ""): ChatMessage {
  const data = (Object.entries(turn.data) as [keyof ChatData, unknown][])
    .filter(([name]) => phase === "done" || name === "check")
    .map(([name, value]) => ({ type: `data-${name}`, data: value }) as ChatMessage["parts"][number]);
  if (phase === "done" && turn.draft !== undefined) {
    data.push({ type: "data-recordedDraft", data: { text: turn.draft } });
  }
  return {
    id: `reply-${play}${i}`,
    role: "assistant",
    parts: phase === "done" ? [{ type: "text", text: turn.reply }, ...data] : data,
  };
}

/** The conversation as the page shows it at `shown`, as chat messages. */
export function messagesAt(rec: Recording, shown: Shown, play = ""): ChatMessage[] {
  const out: ChatMessage[] = [];
  rec.turns.forEach((t, i) => {
    if (i > shown.turn) return;
    const phase = i < shown.turn ? "done" : shown.phase;
    out.push(userMessage(t, i, play));
    if (phase !== "user") out.push(replyMessage(t, i, phase, play));
  });
  return out;
}
