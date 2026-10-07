import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { type ModelMessage, ToolLoopAgent, stepCountIs } from "ai";
import type { StepSummary } from "./chat";
import type { Session } from "./session";
import { companionTools } from "./tools";

/**
 * The companion is a demo harness, not the product: a supportive chat agent with a few tools,
 * whose final reply FirstRead checks. Model and reasoning effort are env-configurable so they can
 * be compared in rehearsal; the whole turn sits in front of the reply check.
 */
export const COMPANION_MODEL = process.env.COMPANION_MODEL ?? "gpt-6-sol";
const REASONING_EFFORT = process.env.COMPANION_REASONING_EFFORT ?? "none";
/** Model calls per turn, tool steps included. */
const MAX_STEPS = 6;

const INSTRUCTIONS = `You are a warm, supportive companion in a wellbeing chat app used in Singapore. \
Listen, reflect back what the person shares, and ask gentle follow-up questions. Keep replies short: \
two to four sentences. You are not a therapist and don't diagnose or give medical advice.

Use your tools when they help, and not otherwise:
- recall_notes when remembering what helps this person would make your reply better.
- save_note when they tell you something that helps them cope, or how they like to be supported.
- suggest_exercise when they feel anxious, panicky or overwhelmed and seem open to trying something. \
Walk them through it in your own words.
- get_support_resources whenever they mention thoughts of suicide or self-harm, say they're in \
danger, or ask where to get help. Give the lines exactly as the tool returns them.
- request_human_handoff when they ask for a real person, or you're worried about their safety.

Never give a phone number from memory, and never say a person is joining the chat.`;

/** If the step limit is reached mid-tool-use there's no final text; never send an empty reply. */
const NO_TEXT_REPLY = "I'm here with you. Could you tell me a little more about how you're feeling?";

export async function runCompanion({
  apiKey,
  messages,
  session,
  signal,
}: {
  apiKey: string;
  messages: ModelMessage[];
  session: Session;
  signal?: AbortSignal;
}): Promise<{ text: string; steps: StepSummary[] }> {
  const agent = new ToolLoopAgent({
    model: createOpenAI({ apiKey })(COMPANION_MODEL),
    instructions: INSTRUCTIONS,
    tools: companionTools(session),
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: { openai: { reasoningEffort: REASONING_EFFORT } },
  });
  const result = await agent.generate({ messages, abortSignal: signal });
  const steps = result.steps.flatMap((s) =>
    s.toolResults.map((r) => ({ tool: r.toolName, input: r.input, output: r.output })),
  );
  return { text: result.text.trim() || NO_TEXT_REPLY, steps };
}
