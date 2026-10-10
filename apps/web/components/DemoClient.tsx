"use client";

import type { RiskLevel } from "firstread";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";
import { GROUPS, SCENARIOS } from "@/lib/scenarios";
import { Composer, CompanionReply, dataPart, errorMessage, messageText, UserBubble } from "./CompanionChat";
import { DemoNotice } from "./DemoNotice";
import { Logo } from "./Logo";
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

/**
 * /demo, on one screen: the controls and the notice on glass at the top, then the conversation,
 * which is the only thing that scrolls, with the message box pinned under it.
 */
export function DemoClient() {
  const chat = useCompanionChat();
  const [keyOpen, setKeyOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // When each message was sent, for the live strip. Written the first time a message is rendered,
  // which is the moment it's sent; idempotent, so a repeated render doesn't move it.
  const sentAt = useRef(new Map<string, number>());
  const rows = exchanges(chat.messages);
  for (const e of rows) if (!sentAt.current.has(e.user.id)) sentAt.current.set(e.user.id, Date.now());
  const latestRisk = [...chat.messages]
    .reverse()
    .map((m) => dataPart(m, "risk"))
    .find(Boolean);

  // Keep the latest turn in view as messages and notes come in.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth() });
  }, [chat.messages, chat.busy]);

  return (
    <>
      <Controls chat={chat} keyOpen={keyOpen} onToggleKey={() => setKeyOpen(!keyOpen)} />
      <DemoNotice />
      {(keyOpen || (!chat.key && chat.error)) && (
        <div className="glass shrink-0 rounded-xl p-4">
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

      <section aria-label="Conversation" className="glass flex min-h-80 flex-1 flex-col overflow-hidden rounded-2xl">
        {rows.length > 0 && (
          <header className={`${ROW} gutter`}>
            <div className="col-span-2 px-4 pt-3 pb-2 lg:col-span-1 lg:col-start-3 lg:px-5 lg:py-4">
              <NowSummary risk={latestRisk} waiting />
            </div>
            <div className="col-span-2 self-center px-4 pb-3 text-sm text-ink/75 lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:max-w-[60ch] lg:px-6 lg:py-4">
              <p className="hidden sm:block">
                {chat.replay
                  ? `“${chat.replay.scenario.title}”, recorded ${recordedOn(chat.replay.recordedAt)} through the live pipeline: real Jev, the real companion, real timings. ${chat.replay.scenario.shows}${chat.jevDown ? " Jev was up when this was recorded; “Simulate Jev being down” applies to live messages." : ""}`
                  : chat.jevDown
                    ? "Jev is switched off for this conversation. Every FirstRead check fails, so watch it fail closed: no reply goes out unchecked."
                    : chat.playing
                      ? `Playing “${chat.playing.title}” live. ${chat.playing.shows}`
                      : "Each reply appears only once FirstRead has checked it."}
              </p>
              {chat.replay && <ReplayControls chat={chat} />}
            </div>
          </header>
        )}

        <div
          ref={scroller}
          className="margin-paper gutter-scroll min-h-0 flex-1 overflow-y-auto border-y border-ink/8 bg-canvas"
          aria-live="polite"
        >
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
                    <TurnNote
                      reply={e.reply}
                      before={i === 0 ? null : levelAfter(rows[i - 1])}
                      startedAt={sentAt.current.get(e.user.id)}
                      live={pending && chat.busy}
                      speed={chat.replay?.speed ?? 1}
                    />
                  </div>
                </article>
              );
            })
          )}
          {chat.error && <p className="px-6 py-4 text-sm text-danger lg:max-w-[calc(100%-24.5rem)]">{errorMessage(chat.error)}</p>}
        </div>

        <footer className={`${ROW} gutter`}>
          <div className="col-span-2 p-3 lg:col-span-1 lg:px-6 lg:py-3">
            <Composer chat={chat} />
          </div>
          <div className="hidden lg:col-start-3 lg:block lg:px-5 lg:py-3">
            <MarginKey />
          </div>
        </footer>
      </section>
    </>
  );
}

function Controls({ chat, keyOpen, onToggleKey }: { chat: CompanionChatState; keyOpen: boolean; onToggleKey: () => void }) {
  return (
    <div className="glass flex shrink-0 flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-sm">
      <h1 className="mr-2">
        <Link href="/" className="block rounded-md">
          <Logo />
          <span className="sr-only">: the demo</span>
        </Link>
      </h1>
      <label className="sr-only" htmlFor="scenario">
        Play a scenario
      </label>
      <select
        id="scenario"
        className="h-9 w-48 rounded-md border border-line bg-canvas pr-8 pl-3 hover:bg-raised sm:w-52"
        value={chat.playing?.id ?? chat.replay?.scenario.id ?? ""}
        onChange={(e) => {
          const s = SCENARIOS.find((x) => x.id === e.target.value);
          if (s) chat.playScenario(s);
        }}
        disabled={chat.busy && !chat.playing}
      >
        <option value="">Play a scenario</option>
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {SCENARIOS.filter((s) => s.group === g).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {chat.playing && (
        <button type="button" onClick={chat.stopScenario} className="flex h-9 items-center gap-2 rounded-md border border-line bg-canvas px-3 hover:bg-raised">
          Stop
        </button>
      )}
      <button type="button" onClick={chat.newConversation} className="flex h-9 items-center gap-2 rounded-md border border-line bg-canvas px-3 hover:bg-raised">
        <span className="sm:hidden">New</span>
        <span className="hidden sm:inline">New conversation</span>
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
            <>
              <span className="sm:hidden">Add key</span>
              <span className="hidden sm:inline">Add your OpenAI key</span>
            </>
          )}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={chat.jevDown}
          onClick={() => chat.setJevDown(!chat.jevDown)}
          className="flex h-9 items-center gap-2.5 rounded-md border border-line bg-canvas pr-3 pl-2.5 hover:bg-raised"
        >
          <span
            aria-hidden="true"
            className={`relative h-5 w-9 rounded-full transition-colors ${chat.jevDown ? "bg-level-crisis" : "bg-muted/30"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-canvas shadow-sm transition-transform motion-reduce:transition-none ${chat.jevDown ? "translate-x-4" : ""}`}
            />
          </span>
          <span className="sm:hidden">Jev down</span>
          <span className="hidden sm:inline">Simulate Jev being down</span>
        </button>
        <Link href="/deck/1" className="px-2 text-accent hover:underline">
          <span className="sm:hidden">Talk</span>
          <span className="hidden sm:inline">The talk</span>
        </Link>
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
        <p className="mt-1 text-sm text-muted">
          Each one replays a run recorded through the live pipeline, so it needs no key.
        </p>
        {GROUPS.map((g) => (
          <section key={g} className="mt-5" aria-labelledby={`group-${g}`}>
            <h2 id={`group-${g}`} className="text-sm font-medium text-ink/75">
              {g}
            </h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {SCENARIOS.filter((s) => s.group === g).map((s) => (
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
          </section>
        ))}
        {chat.jevDown && (
          <p className="mt-5 text-sm text-muted">
            Jev is switched off for live messages. Every FirstRead check will fail, so you can watch it fail closed: no
            reply goes out unchecked. The scenarios are recordings, made with Jev up.
          </p>
        )}
        {!chat.key && (
          <p className="mt-5 text-sm text-muted">
            Your own messages run live, with your OpenAI key.{" "}
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

const recordedOn = (iso: string) => new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "long" });

/** A replay's controls: speed, skip to the end, and running the same scenario live with a key. */
function ReplayControls({ chat }: { chat: CompanionChatState }) {
  const replay = chat.replay!;
  const button = "h-8 rounded-md border border-line bg-canvas px-3 text-ink hover:bg-raised disabled:opacity-40";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-muted sm:hidden">Recorded {recordedOn(replay.recordedAt)}</span>
      {replay.finished ? (
        <button type="button" onClick={() => chat.playScenario(replay.scenario)} className={button}>
          Play again
        </button>
      ) : (
        <>
          <button
            type="button"
            aria-pressed={replay.speed === 2}
            onClick={() => replay.setSpeed(replay.speed === 2 ? 1 : 2)}
            className={`${button} ${replay.speed === 2 ? "border-ink/40 bg-raised" : ""}`}
          >
            2× speed
          </button>
          <button type="button" onClick={replay.skip} className={button}>
            Skip to end
          </button>
        </>
      )}
      {chat.key && (
        <button type="button" onClick={() => chat.playLive(replay.scenario)} className={button}>
          Run it live
        </button>
      )}
    </div>
  );
}
