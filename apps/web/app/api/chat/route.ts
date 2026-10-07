import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { after } from "next/server";
import { type ChatMessage, MAX_MESSAGE_LENGTH, OPENAI_KEY_HEADER } from "@/lib/chat";
import { COMPANION_MODEL, draftReply } from "@/lib/companion";
import { guard } from "@/lib/firstread";
import { extractNotes } from "@/lib/notes";
import { MAX_NOTES, memorySessionStore } from "@/lib/session";
import { DraftTimeoutError, type TurnResult, runTurn } from "@/lib/turn";

/** A full turn: the companion's call plus FirstRead's checks. */
export const maxDuration = 60;

// In memory: per instance, so the deployed app needs a hosted store (HY-22).
const sessions = memorySessionStore();

/**
 * Error details for the server log, never the error object itself: AI SDK errors can carry the
 * request (the user's messages) and provider messages can echo part of the API key.
 */
function describeError(error: unknown): string {
  const e = error as { name?: string; message?: string; statusCode?: number };
  const message = (e?.message ?? String(error)).replace(/sk-[A-Za-z0-9_*-]+/g, "sk-[redacted]");
  return `${e?.name ?? "Error"}${e?.statusCode ? ` (${e.statusCode})` : ""}: ${message}`;
}

function companionErrorMessage(error: unknown): string {
  const status = (error as { statusCode?: number })?.statusCode;
  if (status === 401) return "Your OpenAI API key was rejected. Check it and try again.";
  if (error instanceof DraftTimeoutError) return "The companion took too long, so FirstRead sent a safe reply instead.";
  return "The companion couldn't reply, so FirstRead sent a safe reply instead.";
}

export async function POST(req: Request) {
  // The visitor's own key (HY-153). Only local development may fall back to the server's key.
  const apiKey =
    req.headers.get(OPENAI_KEY_HEADER)?.trim() ||
    (process.env.NODE_ENV === "development" ? process.env.OPENAI_API_KEY : undefined);
  if (!apiKey) return Response.json({ error: "Add your OpenAI API key to chat live." }, { status: 401 });

  // The client sends only the new message: the history the checks rely on lives on the server.
  const { id, message }: { id?: unknown; message?: ChatMessage } = await req.json();
  const text =
    message?.role === "user"
      ? message.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim()
      : "";
  if (typeof id !== "string" || !id || !text) return Response.json({ error: "Bad request." }, { status: 400 });
  if (text.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 });
  }

  let finished!: (result: TurnResult | null) => void;
  const turnDone = new Promise<TurnResult | null>((resolve) => (finished = resolve));

  // Notes for the next turn, once the reply has gone out. Only from turns the companion answered.
  after(async () => {
    const result = await turnDone;
    if (!result || result.audit.action !== "send" || result.audit.failures.length) return;
    try {
      const { notes: known } = await sessions.get(id);
      if (known.length >= MAX_NOTES) return;
      const found = await extractNotes({ apiKey, userText: text, known });
      if (found.length) {
        await sessions.update(id, (s) => (s.notes = [...s.notes, ...found].slice(0, MAX_NOTES)));
      }
    } catch (error) {
      console.error("notes:", describeError(error));
    }
  });

  const stream = createUIMessageStream<ChatMessage>({
    async execute({ writer }) {
      try {
        const session = await sessions.get(id);
        const result = await runTurn(
          text,
          session,
          {
            guard,
            draft: ({ history, text, notes, signal }) => draftReply({ apiKey, history, text, notes, signal }),
          },
          (check, ms) =>
            writer.write({
              type: "data-check",
              data: check.ok ? { ok: true, level: check.level, ms } : { ok: false, reason: check.reason, ms },
            }),
        );
        await sessions.save(id, session);
        finished(result);

        const { audit, exercise, handoff, shortCircuit, draftError, timings } = result;
        if (draftError) {
          console.error("companion:", describeError(draftError));
          writer.write({ type: "data-companionError", data: { message: companionErrorMessage(draftError) } });
        }
        writer.write({
          type: "data-audit",
          data: {
            level: audit.level,
            action: audit.action,
            failures: audit.failures,
            userSignals: audit.userSignals,
            replySignals: audit.replySignals,
            shortCircuit,
          },
        });
        if (handoff) writer.write({ type: "data-handoff", data: { reason: handoff.reason } });
        if (exercise) {
          writer.write({ type: "data-exercise", data: { id: exercise.id, name: exercise.name, steps: [...exercise.steps] } });
        }
        writer.write({ type: "data-timing", data: { model: COMPANION_MODEL, ...timings } });

        // Only what FirstRead approved, in one piece, never streamed.
        const textId = crypto.randomUUID();
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: audit.reply });
        writer.write({ type: "text-end", id: textId });
      } catch (error) {
        finished(null);
        throw error;
      }
    },
    onError(error) {
      console.error("chat route:", describeError(error));
      return "Something went wrong. Please try again.";
    },
  });
  return createUIMessageStreamResponse({ stream });
}
