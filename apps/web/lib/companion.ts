import "server-only";
import { openai } from "@ai-sdk/openai";
import { type ModelMessage, generateText } from "ai";

/**
 * The companion is a demo harness, not the product: a plain supportive chatbot whose drafts
 * FirstRead checks. Model and reasoning effort are env-configurable so they can be compared in
 * rehearsal; draft time sits in front of the reply check on every turn.
 */
export const COMPANION_MODEL = process.env.COMPANION_MODEL ?? "gpt-6-sol";
const REASONING_EFFORT = process.env.COMPANION_REASONING_EFFORT ?? "none";

const SYSTEM = `You are a warm, supportive companion in a wellbeing chat app. Listen, reflect back what \
the person shares, and ask gentle follow-up questions. Keep replies short: two to four sentences. \
You are not a therapist and don't diagnose or give medical advice.`;

export async function draftReply(messages: ModelMessage[], signal?: AbortSignal): Promise<string> {
  const { text } = await generateText({
    model: openai(COMPANION_MODEL),
    system: SYSTEM,
    messages,
    providerOptions: { openai: { reasoningEffort: REASONING_EFFORT } },
    abortSignal: signal,
  });
  return text;
}
