"use client";

import { type FormEvent, useState } from "react";
import type { ChatData, ChatMessage } from "@/lib/chat";
import type { CompanionChatState } from "./useCompanionChat";

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
