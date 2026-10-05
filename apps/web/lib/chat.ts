import type { UIMessage } from "ai";

/** Data parts the chat route sends alongside the reply. HY-19 adds the user and reply checks. */
export type ChatData = {
  timing: { model: string; draftMs: number };
};

export type ChatMessage = UIMessage<never, ChatData>;
