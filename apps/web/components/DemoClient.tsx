"use client";

import type { RiskLevel } from "firstread";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";
import { SCENARIOS } from "@/lib/scenarios";
import { Composer, CompanionReply, dataPart, errorMessage, messageText, UserBubble } from "./CompanionChat";
import { MarginKey, MarginRule, NowSummary, TurnNote } from "./Margin";
import { OpenAIKeyField } from "./OpenAIKeyField";
import { type CompanionChatState, useCompanionChat } from "./useCompanionChat";

/**
 * Every row of the demo shares these columns, so a turn's note sits level with the turn: the
 * conversation, the margin rule, FirstRead's notes. On a phone the rule runs down the left edge
 * and each note folds under its reply.
 */
const ROW = "grid grid-cols-[1.75rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_2.5rem_22rem]";

/** One user message and the reply to it. */
type Exchange = { user: ChatMessage; reply: ChatMessage | undefined };

function exchanges(messages: ChatMessage[]): Exchange[] {
  const out: Exchange[] = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ user: m, reply: undefined });
    else if (out.length > 0 && !out.at(-1)!.reply) out.at(-1)!.reply = m;
  }
  return out;
}

const smooth = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

const levelAfter = (e: Exchange | undefined): RiskLevel | null => (e?.reply && dataPart(e.reply, "risk")?.level) || null;

/** /demo: the conversation, with FirstRead's notes in its margin, and the demo controls. */
export function DemoClient() {
  const chat = useCompanionChat();
  const [keyOpen, setKeyOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const rows = exchanges(chat.messages);
  const started = rows.length > 0;
  const latestRisk = [...chat.messages]
    .reverse()
    .map((m) => dataPart(m, "risk"))
    .find(Boolean);

  // Keep the latest turn in view as messages and notes come in.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth() });
  }, [chat.messages, chat.busy]);

  // When a conversation starts, bring the controls and the whole conversation into view.
  useEffect(() => {
    if (!started) return;
    top.current?.scrollIntoView({ block: "start", behavior: smooth() });
  }, [started]);

  return (
    <div ref={top} className="scroll-mt-4 space-y-4">
      <Controls chat={chat} keyOpen={keyOpen} onToggleKey={() => setKeyOpen(!keyOpen)} />
      {(keyOpen || (!chat.key && chat.error)) && (
        <div className="rounded-xl border border-line bg-margin p-4">
          <OpenAIKeyField
            value={chat.key}
            onSave={(k) => {
              chat.setKey(k);
              setKeyOpen(false);
            }}
            onForget={chat.forgetKey}
          />
        </div>
      )}

      <section aria-label="Conversation" className="margin-paper overflow-hidden rounded-xl border border-line bg-canvas">
        {rows.length > 0 && (
          <header className={`${ROW} gutter border-b border-line`}>
            <div className="col-span-2 bg-margin p-5 lg:col-span-1 lg:col-start-3 lg:bg-transparent">
              <NowSummary risk={latestRisk} waiting />
            </div>
            <p className="col-span-2 self-center px-5 pt-3 pb-4 text-sm text-muted lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:max-w-[60ch] lg:px-6 lg:py-5">
              {chat.jevDown
                ? "Jev is switched off for this conversation. Every FirstRead check fails, so watch it fail closed: no reply goes out unchecked."
                : chat.playing
                  ? `Playing “${chat.playing.title}”. ${chat.playing.shows}`
                  : "Each reply appears only once FirstRead has checked it."}
            </p>
          </header>
        )}

        <div ref={scroller} className="gutter-scroll h-[min(44rem,72dvh)] overflow-y-auto lg:h-[max(24rem,calc(100dvh-19rem))]" aria-live="polite">
          {rows.length === 0 ? (
            <EmptyState chat={chat} onAddKey={() => setKeyOpen(true)} />
          ) : (
            rows.map((e, i) => {
              const pending = !e.reply || !dataPart(e.reply, "audit");
              return (
                <article key={e.user.id} className={ROW} aria-label={`Turn ${i + 1}`}>
                  <div className="col-start-2 row-start-1 space-y-3 py-4 pr-4 pl-1 lg:col-start-1 lg:px-6">
                    <UserBubble text={messageText(e.user)} />
                    <CompanionReply message={e.reply} pending={pending && chat.busy} />
                  </div>
                  <div className="col-start-1 row-span-2 row-start-1 lg:col-start-2 lg:row-span-1">
                    <MarginRule before={i === 0 ? null : levelAfter(rows[i - 1])} after={pending ? null : levelAfter(e)} />
                  </div>
                  <div className="col-start-2 row-start-2 mr-4 mb-4 rounded-lg border border-line bg-margin p-4 lg:col-start-3 lg:row-start-1 lg:m-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-5 lg:py-4">
                    <TurnNote reply={e.reply} before={i === 0 ? null : levelAfter(rows[i - 1])} />
                  </div>
                </article>
              );
            })
          )}
          {chat.error && <p className="px-6 py-4 text-sm text-danger lg:max-w-[calc(100%-24.5rem)]">{errorMessage(chat.error)}</p>}
        </div>

        <footer className={`${ROW} gutter border-t border-line`}>
          <div className="col-span-2 p-3 lg:col-span-1 lg:px-6 lg:py-4">
            <Composer chat={chat} />
          </div>
          <div className="hidden lg:col-start-3 lg:block lg:px-5 lg:py-4">
            <MarginKey thresholds={latestRisk?.thresholds} />
          </div>
        </footer>
      </section>
    </div>
  );
}

function Controls({ chat, keyOpen, onToggleKey }: { chat: CompanionChatState; keyOpen: boolean; onToggleKey: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="sr-only" htmlFor="scenario">
        Play a scenario
      </label>
      <select
        id="scenario"
        className="h-9 rounded-md border border-line bg-canvas pr-8 pl-3 hover:bg-raised"
        value={chat.playing?.id ?? ""}
        onChange={(e) => {
          const s = SCENARIOS.find((x) => x.id === e.target.value);
          if (s) chat.playScenario(s);
        }}
        disabled={chat.busy && !chat.playing}
      >
        <option value="">Play a scenario</option>
        {SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      {chat.playing && (
        <button type="button" onClick={chat.stopScenario} className="flex h-9 items-center gap-2 rounded-md border border-line bg-canvas px-3 hover:bg-raised">
          Stop
        </button>
      )}
      <button type="button" onClick={chat.newConversation} className="flex h-9 items-center gap-2 rounded-md border border-line bg-canvas px-3 hover:bg-raised">
        New conversation
      </button>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <button
          type="button"
          onClick={onToggleKey}
          aria-expanded={keyOpen}
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-canvas px-3 hover:bg-raised"
        >
          <span className={`size-2 rounded-full ${chat.key ? "bg-accent" : "border border-muted"}`} aria-hidden="true" />
          {chat.key ? (
            <>
              Your key <span className="font-mono text-muted">…{chat.key.slice(-4)}</span>
            </>
          ) : (
            "Add your OpenAI key"
          )}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={chat.jevDown}
          onClick={() => chat.setJevDown(!chat.jevDown)}
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-canvas px-3 hover:bg-raised gap-2.5 pl-2.5"
        >
          <span
            aria-hidden="true"
            className={`relative h-5 w-9 rounded-full transition-colors ${chat.jevDown ? "bg-level-crisis" : "bg-muted/30"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-canvas shadow-sm transition-transform motion-reduce:transition-none ${chat.jevDown ? "translate-x-4" : ""}`}
            />
          </span>
          Simulate Jev being down
        </button>
      </div>
    </div>
  );
}

/** An empty conversation: the scenarios, ready to play, and a reminder about the key. */
function EmptyState({ chat, onAddKey }: { chat: CompanionChatState; onAddKey: () => void }) {
  return (
    <div className={ROW}>
      <div className="col-span-2 p-5 lg:col-span-1 lg:p-6">
        <p className="text-xl font-semibold tracking-tight">Play a scripted conversation, or write your own below.</p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => chat.playScenario(s)}
                className="h-full w-full rounded-lg border border-line bg-margin px-4 py-3 text-left transition-colors hover:border-muted hover:bg-raised motion-reduce:transition-none"
              >
                <span className="block font-medium">{s.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{s.shows}</span>
              </button>
            </li>
          ))}
        </ul>
        {chat.jevDown && (
          <p className="mt-5 text-sm text-muted">
            Jev is switched off. Every FirstRead check will fail, so you can watch it fail closed: no reply goes out
            unchecked.
          </p>
        )}
        {!chat.key && (
          <p className="mt-5 text-sm text-muted">
            Scenarios and your own messages run live, with your OpenAI key.{" "}
            <button type="button" onClick={onAddKey} className="text-accent hover:underline">
              Add your key
            </button>
          </p>
        )}
      </div>
      <div className="hidden lg:col-start-3 lg:block lg:p-6">
        <NowSummary risk={undefined} />
      </div>
    </div>
  );
}
