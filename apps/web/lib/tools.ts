import { tool } from "ai";
import { resourcesFor } from "firstread/resources";
import { z } from "zod";
import { EXERCISES, EXERCISE_KINDS } from "./exercises";
import { MAX_NOTES, type Session } from "./session";

const MAX_NOTE_LENGTH = 200;

/**
 * The companion's tools. They read and change `session`, which the route saves after the turn.
 * FirstRead never sees tool steps: it checks the user's message and the final reply.
 */
export function companionTools(session: Session) {
  return {
    get_support_resources: tool({
      description:
        "Get verified crisis and support lines for a country. Use it whenever the person mentions " +
        "thoughts of suicide or self-harm, says they're in danger, or asks where to get help. " +
        "Give the lines exactly as returned; never give a phone number from memory.",
      inputSchema: z.object({
        country: z.string().describe("Country code or name. The person is in Singapore unless they say otherwise."),
      }),
      execute: async ({ country }) => {
        const r = resourcesFor(country);
        return { country: r.countryName, lines: r.lines, emergency: r.emergency, checked: r.checked };
      },
    }),

    request_human_handoff: tool({
      description:
        "Ask for a person to join the conversation. Use it if the person asks for a real person, or " +
        "if you're worried about their safety. Then tell them honestly what the result says.",
      inputSchema: z.object({
        reason: z.string().max(300).describe("Why a person should join, in one sentence."),
      }),
      execute: async ({ reason }) => {
        session.handoffs.push({ reason, at: new Date().toISOString() });
        // A demo has no one on call. Saying otherwise would be a false promise at the worst moment.
        return {
          status: "unavailable",
          message:
            "This is a demo, so no person can join this chat. Tell the person that honestly, and " +
            "give them the support lines from get_support_resources so they can reach someone now.",
        };
      },
    }),

    save_note: tool({
      description:
        "Remember something that helps this person cope, or how they like to be supported, for the " +
        "rest of this conversation. Don't save names, addresses, contact or medical details.",
      inputSchema: z.object({
        kind: z.enum(["coping", "preference", "other"]),
        text: z.string().max(MAX_NOTE_LENGTH).describe("A short note in your own words."),
      }),
      execute: async ({ kind, text }) => {
        if (session.notes.length >= MAX_NOTES) return { saved: false, reason: "note limit reached" };
        session.notes.push({ kind, text: text.slice(0, MAX_NOTE_LENGTH), at: new Date().toISOString() });
        return { saved: true, notes: session.notes.length };
      },
    }),

    recall_notes: tool({
      description: "Recall what this person has told you helps them, saved earlier in this conversation.",
      inputSchema: z.object({}),
      execute: async () => ({ notes: session.notes.map(({ kind, text }) => ({ kind, text })) }),
    }),

    suggest_exercise: tool({
      description:
        "Get a short breathing or grounding exercise to offer when the person feels anxious, " +
        "panicky or overwhelmed and seems open to trying something.",
      inputSchema: z.object({ kind: z.enum(EXERCISE_KINDS) }),
      execute: async ({ kind }) => EXERCISES[kind],
    }),
  };
}
