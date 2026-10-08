import type { ChatData, ChatMessage } from "./chat";

/**
 * A conversation recorded through the real chat route (scripts/record-replay.ts): per turn, the
 * user's message, the reply that went out, and the data parts the page received. Turned back into
 * chat messages, it renders with the same components as a live chat (the deck's replay, HY-159;
 * the demo's replay mode, HY-145).
 */
export type RecordedTurn = { user: string; reply: string; data: Partial<ChatData> };
export type Recording = { scenario: string; title: string; recordedAt: string; turns: RecordedTurn[] };

export function userMessage(turn: RecordedTurn, i: number): ChatMessage {
  return { id: `user-${i}`, role: "user", parts: [{ type: "text", text: turn.user }] };
}

/**
 * The reply as the page held it at one moment of the turn: `"checked"` once the user check has
 * answered (only its part), `"done"` once the reply is in (everything).
 */
export function replyMessage(turn: RecordedTurn, i: number, phase: "checked" | "done"): ChatMessage {
  const data = (Object.entries(turn.data) as [keyof ChatData, unknown][])
    .filter(([name]) => phase === "done" || name === "check")
    .map(([name, value]) => ({ type: `data-${name}`, data: value }) as ChatMessage["parts"][number]);
  return {
    id: `reply-${i}`,
    role: "assistant",
    parts: phase === "done" ? [{ type: "text", text: turn.reply }, ...data] : data,
  };
}
