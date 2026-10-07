"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { type ChatMessage, OPENAI_KEY_HEADER } from "@/lib/chat";
import { OpenAIKeyField, useOpenAIKey } from "./OpenAIKeyField";

/**
 * The route's errors are short and written for the user: a JSON body before the stream starts (no
 * key), or plain text from the stream (key rejected). Anything else gets a generic message.
 */
function errorMessage(error: Error): string {
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

export function CompanionChat({ compact = false }: { compact?: boolean }) {
  const { key, setKey, forget } = useOpenAIKey();
  // The transport lives for the component's lifetime, so it reads the key through a ref.
  const keyRef = useRef(key);
  keyRef.current = key;
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        headers: (): Record<string, string> => (keyRef.current ? { [OPENAI_KEY_HEADER]: keyRef.current } : {}),
      }),
  );
  const { messages, sendMessage, status, error } = useChat<ChatMessage>({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the latest turn in view as messages and the "replying" line come and go.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className={`flex flex-col rounded-2xl border border-line bg-panel ${compact ? "h-[26rem]" : "h-[36rem]"}`}>
      <OpenAIKeyField value={key} onSave={setKey} onForget={forget} />
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-muted">Say hello to the companion.</p>}
        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const timing = m.parts.find((p) => p.type === "data-timing")?.data;
          const steps = m.parts.find((p) => p.type === "data-steps")?.data ?? [];
          return (
            <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
              <div
                className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-left ${
                  m.role === "user" ? "bg-accent text-on-accent" : "bg-raised"
                }`}
              >
                {text}
              </div>
              {timing && (
                <p className="mt-1 text-xs text-muted">
                  {timing.model} · {steps.length ? `used ${steps.map((s) => s.tool).join(", ")}` : "no tools"} ·
                  {" "}drafted in {(timing.draftMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          );
        })}
        {busy && <p className="text-sm text-muted">Companion is replying…</p>}
        {error && <p className="text-sm text-danger">{errorMessage(error)}</p>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          aria-label="Message"
          className="flex-1 rounded-xl border border-line bg-raised px-3 py-2 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-accent px-4 py-2 font-medium text-on-accent disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
