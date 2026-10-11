import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { DEFAULT_RISK_CONFIG } from "firstread";
import { after } from "next/server";
import { type ChatMessage, JEV_DOWN_HEADER, MAX_MESSAGE_LENGTH, OPENAI_KEY_HEADER } from "@/lib/chat";
import { COMPANION_MODEL, draftReply } from "@/lib/companion";
import { guardWithJevDown, liveGuard } from "@/lib/firstread";
import { chatCapRefusal, clientIp, rateRefusal } from "@/lib/limits";
import { extractNotes } from "@/lib/notes";
import { redis } from "@/lib/redis";
import { MAX_NOTES, memorySessionStore, redisSessionStore } from "@/lib/session";
import { DraftTimeoutError, type TurnResult, runTurn } from "@/lib/turn";

/** A full turn: the companion's call plus FirstRead's checks. */
export const maxDuration = 60;

// Redis when it's configured, as on Vercel (HY-22): the next message may reach another instance.
// In memory for local development, where there's one.
const sessions = redis ? redisSessionStore(redis) : memorySessionStore();
if (!redis && process.env.VERCEL) {
  console.warn("No Redis configured: sessions are per instance, so a chat can lose its history and risk level.");
}

/**
 * Error details for the server log, never the error object itself: AI SDK errors can carry the
 * request (the user's messages) and provider messages can echo part of the API key.
 */
function describeError(error: unknown): string {
  const e = error as { name?: string; message?: string; statusCode?: number };
  const message = (e?.message ?? String(error)).replace(/sk-[A-Za-z0-9_*-]+/g, "sk-[redacted]");
  return `${e?.name ?? "Error"}${e?.statusCode ? ` (${e.statusCode})` : ""}: ${message}`;
}

/** A turn the demo won't run, with the reason for the visitor (e.g. the conversation's cap). */
class TurnRefused extends Error {}

function companionErrorMessage(error: unknown, ourKey: boolean): string {
  const status = (error as { statusCode?: number })?.statusCode;
  if (ourKey && (status === 401 || status === 429)) {
    return "The demo's OpenAI budget is used up, so FirstRead sent a safe reply instead. Add your own OpenAI key to keep chatting.";
  }
  if (status === 401) return "Your OpenAI API key was rejected. Check it and try again.";
  if (error instanceof DraftTimeoutError) return "The companion took too long, so FirstRead sent a safe reply instead.";
  return "The companion couldn't reply, so FirstRead sent a safe reply instead.";
}

export async function POST(req: Request) {
  // "Jev down" needs no Jev key; every other turn does, whoever's OpenAI key it runs on.
  const jevDown = req.headers.get(JEV_DOWN_HEADER) === "1";
  const guard = jevDown ? guardWithJevDown : liveGuard();
  if (!guard) {
    return Response.json({ error: "Live chat is off: FirstRead's checks aren't configured. The scenarios still play." }, { status: 503 });
  }

  // The visitor's own key if they gave one, else ours (HY-153: typed messages run on our key during
  // judging, capped by the limits below and the OpenAI project's spending limit).
  const ownKey = req.headers.get(OPENAI_KEY_HEADER)?.trim();
  const apiKey = ownKey || process.env.OPENAI_API_KEY;
  const ourKey = !ownKey;
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
  if (redis) {
    const refusal = await rateRefusal({ store: redis, ip: clientIp(req), ourKey });
    if (refusal) return Response.json({ error: refusal }, { status: 429 });
  } else if (ourKey && process.env.NODE_ENV === "production") {
    // Fail closed: without Redis the per-IP limits can't hold, so our key isn't offered at all.
    return Response.json(
      { error: "Live chat on the demo's key is off right now. The scenarios still play, or add your own OpenAI key." },
      { status: 503 },
    );
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
        // One turn at a time per chat: read, run and save in order.
        const { session, result } = await sessions.lock(id, async () => {
          const session = await sessions.get(id);
          const cap = chatCapRefusal(session.conv.turns.filter((t) => t.role === "user").length, ourKey);
          if (cap) throw new TurnRefused(cap);
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
          return { session, result };
        });
        finished(result);

        const { audit, exercise, handoff, shortCircuit, draftError, timings } = result;
        if (draftError) {
          console.error("companion:", describeError(draftError));
          writer.write({ type: "data-companionError", data: { message: companionErrorMessage(draftError, ourKey) } });
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
        const risk = session.conv.risk;
        writer.write({
          type: "data-risk",
          data: {
            level: risk.level,
            peak: risk.peak,
            score: risk.score,
            history: risk.history,
            changes: risk.changes,
            ledger: risk.ledger.map(({ text, level }) => ({ text, level })),
            thresholds: { watch: DEFAULT_RISK_CONFIG.scoreWatch, elevated: DEFAULT_RISK_CONFIG.scoreElevated },
          },
        });

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
      if (error instanceof TurnRefused) return error.message;
      console.error("chat route:", describeError(error));
      return "Something went wrong. Please try again.";
    },
  });
  return createUIMessageStreamResponse({ stream });
}
