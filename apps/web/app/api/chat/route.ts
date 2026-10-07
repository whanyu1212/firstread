import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { type ChatMessage, OPENAI_KEY_HEADER } from "@/lib/chat";
import { COMPANION_MODEL, runCompanion } from "@/lib/companion";
import { memorySessionStore } from "@/lib/session";

/** A full agent turn with tool steps, plus FirstRead's checks once HY-19 lands. */
export const maxDuration = 60;

/** How much history the companion sees. FirstRead keeps its own window for its checks. */
const MAX_MESSAGES = 30;

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

export async function POST(req: Request) {
  // The visitor's own key (HY-153). Only local development may fall back to the server's key.
  const apiKey =
    req.headers.get(OPENAI_KEY_HEADER)?.trim() ||
    (process.env.NODE_ENV === "development" ? process.env.OPENAI_API_KEY : undefined);
  if (!apiKey) return Response.json({ error: "Add your OpenAI API key to chat live." }, { status: 401 });

  const { id, messages }: { id?: unknown; messages?: ChatMessage[] } = await req.json();
  if (typeof id !== "string" || !id || !Array.isArray(messages)) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  // The client sends the whole history; only user and assistant turns reach the model.
  const history = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-MAX_MESSAGES);

  const stream = createUIMessageStream<ChatMessage>({
    async execute({ writer }) {
      const session = await sessions.get(id);
      // HY-19: start FirstRead's user check here, so it runs while the companion works.
      const started = performance.now();
      const { text, steps } = await runCompanion({
        apiKey,
        messages: await convertToModelMessages(history),
        session,
        signal: req.signal,
      });
      await sessions.save(id, session);
      writer.write({ type: "data-steps", data: steps });
      writer.write({
        type: "data-timing",
        data: { model: COMPANION_MODEL, draftMs: Math.round(performance.now() - started) },
      });

      // HY-19: the reply check decides send / replace / escalate before any text is written.
      // The reply goes out in one piece, never streamed: nothing reaches the user unchecked.
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
    },
    onError(error) {
      console.error("chat route:", describeError(error));
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 401) return "Your OpenAI API key was rejected. Check it and try again.";
      return "The companion couldn't reply. Please try again.";
    },
  });
  return createUIMessageStreamResponse({ stream });
}
