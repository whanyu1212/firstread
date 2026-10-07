import type { UIMessage } from "ai";

/**
 * Header carrying the visitor's own OpenAI key (HY-153). The server uses it for that request only
 * and never stores or logs it. Local development falls back to OPENAI_API_KEY in .env.
 */
export const OPENAI_KEY_HEADER = "x-openai-key";

/** One tool the companion used in a turn, for the risk panel (HY-19). */
export interface StepSummary {
  tool: string;
  input: unknown;
  output: unknown;
}

/** Data parts the chat route sends alongside the reply. HY-19 adds the user and reply checks. */
export type ChatData = {
  timing: { model: string; draftMs: number };
  steps: StepSummary[];
};

export type ChatMessage = UIMessage<never, ChatData>;
