"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ChatData, ChatMessage } from "@/lib/chat";
import { LEVEL_LABEL } from "./levels";
import { OpenAIKeyField } from "./OpenAIKeyField";
import { type CompanionChatState, useCompanionChat } from "./useCompanionChat";

/**
 * The route's errors are short and written for the user: a JSON body before the stream starts (no
 * key), or plain text from the stream (key rejected). Anything else gets a generic message.
 */
export function errorMessage(error: Error): string {
  try {
    const body = JSON.parse(error.message) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // not JSON
  }
  const text = error.message.trim();
  if (text && text.length <= 200 && !text.startsWith("<")) return text;
  return "Something went wrong. Please try again.";
}

/** A data part of one message, typed by name. */
export function dataPart<K extends keyof ChatData>(m: ChatMessage, name: K): ChatData[K] | undefined {
  const part = m.parts.find((p) => p.type === `data-${name}`) as { data: ChatData[K] } | undefined;
  return part?.data;
}

export const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)}s`);

export const messageText = (m: ChatMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-xl bg-user px-4 py-2.5 leading-normal whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

/** The companion's side of a turn: its reply (or a "writing" line), the exercise it offered, any error. */
export function CompanionReply({ message, pending }: { message: ChatMessage | undefined; pending: boolean }) {
  const text = message ? messageText(message) : "";
  const exercise = message && dataPart(message, "exercise");
  const companionError = message && dataPart(message, "companionError");
  return (
    <div className="space-y-2">
      {text ? (
        <p className="max-w-[85%] leading-relaxed whitespace-pre-line">
          {text}
        </p>
      ) : (
        pending && (
          <p className="text-sm text-muted">
            <span className="motion-safe:animate-node-wait">Waiting for a reply FirstRead has checked</span>
          </p>
        )
      )}
      {exercise && <ExerciseCard exercise={exercise} />}
      {companionError && <p className="text-sm text-danger">{companionError.message}</p>}
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: ChatData["exercise"] }) {
  return (
    <section
      aria-label={`Exercise: ${exercise.name}`}
      className="max-w-[85%] rounded-lg border border-line bg-margin px-4 py-3"
    >
      <h3 className="font-semibold tracking-tight">{exercise.name}</h3>
      <ol className="mt-2 space-y-1.5 text-sm text-muted">
        {exercise.steps.map((step, i) => (
          <li key={step} className="grid grid-cols-[1.25rem_1fr]">
            <span className="font-mono text-ink">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The message box. Locked while a scenario plays, so the script can't be interleaved. */
export function Composer({ chat }: { chat: CompanionChatState }) {
  const { sendMessage, busy, playing } = chat;
  const [input, setInput] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || playing) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={playing ? `Playing “${playing.title}”` : "Write a message"}
        aria-label="Message"
        disabled={!!playing}
        className="h-10 min-w-0 flex-1 rounded-md border border-line bg-margin px-3 outline-none placeholder:text-muted focus-visible:border-muted focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={busy || !!playing || !input.trim()}
        className="h-10 rounded-md bg-ink px-4 font-medium text-canvas hover:bg-ink/90 disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}

/** A standalone chat (the deck's live slide): its own state, with a line under each reply. */
export function CompanionChat({ compact = false }: { compact?: boolean }) {
  const chat = useCompanionChat();
  return <ChatView chat={chat} compact={compact} />;
}

/** The chat on its own, for where no margin of notes fits: one line per reply says what FirstRead did. */
function ChatView({ chat, compact = false }: { chat: CompanionChatState; compact?: boolean }) {
  const { messages, busy, error, key, setKey, forgetKey } = chat;
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the latest turn in view as messages come in.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  return (
    <div className={`flex flex-col rounded-xl border border-line bg-canvas ${compact ? "h-[26rem]" : "h-[min(40rem,70dvh)]"}`}>
      <div className="border-b border-line p-4">
        <OpenAIKeyField value={key} onSave={setKey} onForget={forgetKey} />
      </div>
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <p className="text-muted">Say hello to the companion.</p>}
        {messages.map((m, i) => {
          if (m.role === "user") return <UserBubble key={m.id} text={messageText(m)} />;
          const audit = dataPart(m, "audit");
          const timing = dataPart(m, "timing");
          return (
            <div key={m.id}>
              <CompanionReply message={m} pending={busy && i === messages.length - 1} />
              {audit && timing && (
                <p className="mt-1.5 font-mono text-xs text-muted">
                  {CAPTION[audit.action]} at {LEVEL_LABEL[audit.level]}, in {secs(timing.totalMs)}
                </p>
              )}
            </div>
          );
        })}
        {busy && messages.at(-1)?.role === "user" && <CompanionReply message={undefined} pending />}
        {error && <p className="text-sm text-danger">{errorMessage(error)}</p>}
      </div>
      <div className="p-3">
        <Composer chat={chat} />
      </div>
    </div>
  );
}

const CAPTION = {
  send: "FirstRead sent the reply as written",
  replace: "FirstRead replaced the reply with a safe one",
  escalate: "FirstRead sent the crisis reply",
} as const;
