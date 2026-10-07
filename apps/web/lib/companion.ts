import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import type { Turn } from "firstread";
import { z } from "zod";
import type { Note } from "./session";
import { EXERCISE_IDS, type ExerciseId, exerciseIndex } from "./skills/exercises";
import { supportLinesSkill } from "./skills/support-lines";

/**
 * The companion is a demo harness, not the product: a supportive agent whose reply FirstRead
 * checks. One model call per turn. It decides what to say and may pick an exercise; the runtime
 * decides what to do (handoffs from FirstRead's signals, notes after the reply). A tool loop would
 * add a full model call per tool, about 3.5-4s each on this model.
 */
// gpt-6-sol at low reasons and answers in ~3.9s (p50) through the whole pipeline; gpt-6.1-sol at
// low made the same safety decisions but took ~8s (Oct 7). Both are env-configurable.
export const COMPANION_MODEL = process.env.COMPANION_MODEL ?? "gpt-6-sol";
const REASONING_EFFORT = process.env.COMPANION_REASONING_EFFORT ?? "low";

function instructions(notes: Note[]): string {
  const remembered = notes.length
    ? `\n\nWhat helps this person, from earlier in this conversation:\n${notes.map((n) => `- ${n.text}`).join("\n")}`
    : "";
  return `You are a warm, supportive companion in a wellbeing chat app used in Singapore. Listen, \
reflect back what the person shares, and ask gentle follow-up questions. Keep replies short: two to \
four sentences. You are not a therapist and don't diagnose or give medical advice.

Whenever they mention thoughts of suicide or self-harm, say they're in danger, or ask where to get \
help, give these lines exactly as written. Never give a phone number from memory.
${supportLinesSkill()}

If they ask to talk to a real person, say honestly that no person can join this chat because it's a \
demo, and give them the lines above so they can reach someone now. Never say a person is joining.

When they feel anxious, panicky or overwhelmed and seem open to trying something, you can offer one \
exercise by putting its id in "exercise". Introduce it in a sentence by name; its steps appear below \
your reply, so don't list them or mention the app. Otherwise set "exercise" to null.
${exerciseIndex()}${remembered}`;
}

const DRAFT = z.object({
  reply: z.string().describe("What you say to the person."),
  exercise: z.enum(EXERCISE_IDS).nullable().describe("An exercise id from the list, or null."),
});

export interface Draft {
  reply: string;
  exercise: ExerciseId | null;
}

export async function draftReply({
  apiKey,
  history,
  text,
  notes,
  signal,
}: {
  apiKey: string;
  /** The conversation as the user saw it: FirstRead's record, replacements included. */
  history: Turn[];
  text: string;
  notes: Note[];
  signal: AbortSignal;
}): Promise<Draft> {
  const { output } = await generateText({
    model: createOpenAI({ apiKey })(COMPANION_MODEL),
    instructions: instructions(notes),
    messages: [...history.map((t) => ({ role: t.role, content: t.text })), { role: "user" as const, content: text }],
    output: Output.object({ schema: DRAFT, name: "companion_reply" }),
    providerOptions: { openai: { reasoningEffort: REASONING_EFFORT } },
    abortSignal: signal,
  });
  return { reply: output.reply.trim(), exercise: output.exercise };
}
