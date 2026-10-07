import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import { z } from "zod";
import type { Note } from "./session";

/**
 * After the reply is sent, pick out anything the person said helps them cope or how they like to be
 * supported, for the next turn's prompt. Runs in the background (after()), so nobody waits for it.
 * Never saves names, contact or medical details.
 */
const NOTES_MODEL = process.env.NOTES_MODEL ?? "gpt-6-luna";
const MAX_NOTE_LENGTH = 200;

const NOTES = z.object({
  notes: z
    .array(z.object({ kind: z.enum(["coping", "preference", "other"]), text: z.string() }))
    .max(2)
    .describe("New things that help this person cope, or how they like to be supported. Usually empty."),
});

export async function extractNotes({
  apiKey,
  userText,
  known,
}: {
  apiKey: string;
  userText: string;
  known: Note[];
}): Promise<Note[]> {
  const { output } = await generateText({
    model: createOpenAI({ apiKey })(NOTES_MODEL),
    instructions:
      "From the person's latest message in a wellbeing chat, list anything they say helps them cope, " +
      "or how they like to be supported, as short notes in your own words. Return an empty list if " +
      "there's nothing new. Never include names, addresses, contact details or medical details." +
      (known.length ? `\nAlready known (don't repeat):\n${known.map((n) => `- ${n.text}`).join("\n")}` : ""),
    prompt: userText,
    output: Output.object({ schema: NOTES, name: "notes" }),
    providerOptions: { openai: { reasoningEffort: "none" } },
  });
  const at = new Date().toISOString();
  return output.notes.map((n) => ({ kind: n.kind, text: n.text.slice(0, MAX_NOTE_LENGTH), at }));
}
