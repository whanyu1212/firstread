"use client";

import type { RiskLevel } from "firstread";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";
import { LIMITS } from "@/lib/limits";
import { assessmentUnavailable } from "@/lib/margin";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";
import { Composer, dataPart, errorMessage } from "./CompanionChat";
import { DemoNotice } from "./DemoNotice";
import { DemoTurn } from "./DemoTurn";
import { Logo } from "./Logo";
import { NowSummary } from "./Margin";
import { OpenAIKeyField } from "./OpenAIKeyField";
import { type CompanionChatState, useCompanionChat } from "./useCompanionChat";

type Exchange = { user: ChatMessage; reply: ChatMessage | undefined };
function exchanges(messages: ChatMessage[]): Exchange[] {
  const out: Exchange[] = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ user: m, reply: undefined });
    else if (out.length > 0 && !out.at(-1)!.reply) out.at(-1)!.reply = m;
  }
  return out;
}
const levelAfter = (e: Exchange | undefined): RiskLevel | null => (e?.reply && dataPart(e.reply, "risk")?.level) || null;
const recommended = SCENARIOS.find((s) => s.id === "crisis")!;
const button = "min-h-10 rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm font-medium transition-colors hover:bg-raised disabled:opacity-40";
const scenarioNames: Record<string, string> = {
  crisis: "See FirstRead intervene",
  hyperbole: "A harmless message",
  "past-window": "Risk remembered across turns",
  person: "A request for a person",
  "long-safe-trip": "A longer, calm conversation",
};

export function DemoClient({ serverKey }: { serverKey: boolean }) {
  const chat = useCompanionChat();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const firstMessage = chat.messages[0]?.id;
  const rows = exchanges(chat.messages);
  const latestReply = rows.at(-1)?.reply;
  const latestTurnRisk = latestReply && dataPart(latestReply, "risk");
  const latestRisk = [...chat.messages].reverse().map((m) => dataPart(m, "risk")).find(Boolean);
  const summaryPending = chat.busy && !latestTurnRisk;
  const summaryUnavailable = assessmentUnavailable(latestReply && dataPart(latestReply, "check"), latestReply && dataPart(latestReply, "audit"));
  const summary = <NowSummary risk={latestRisk} check={latestReply && dataPart(latestReply, "check")} audit={latestReply && dataPart(latestReply, "audit")} pending={summaryPending} waiting />;
  const liveBusy = chat.busy && !chat.replay;
  const activeScenario = chat.replay?.scenario ?? chat.playing;
  const canRunLive = serverKey || Boolean(chat.key);

  useEffect(() => { following.current = true; }, [firstMessage]);
  useEffect(() => {
    const el = scroller.current;
    if (el && following.current) el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  }, [chat.messages, chat.busy]);

  function play(scenario: Scenario) {
    chat.playScenario(scenario);
    setScenariosOpen(false);
  }
  function startLive() {
    chat.newConversation();
    setScenariosOpen(false);
    if (!canRunLive) setSettingsOpen(true);
  }

  return (
    <>
      <nav aria-label="Demo navigation" className="flex shrink-0 flex-wrap items-center justify-between gap-3 py-1">
        <Link href="/" className="rounded-md"><Logo /><span className="sr-only"> home</span></Link>
        <div className="flex items-center gap-2">
          <Link href="/deck/1" className="px-2 text-sm text-ink/75 hover:text-accent">The deck</Link>
          <button type="button" onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen} aria-controls="demo-settings" className={button}>Settings</button>
          <button type="button" onClick={startLive} disabled={liveBusy} className={button}>{rows.length > 0 && !chat.replay ? "New chat" : "Try live"}</button>
        </div>
      </nav>
      <DemoNotice />
      {(settingsOpen || (!chat.key && chat.error)) && (
        <section id="demo-settings" aria-label="Demo settings" className="glass shrink-0 rounded-2xl p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold">OpenAI key</h2>
              <OpenAIKeyField value={chat.key} onSave={(k) => { chat.setKey(k); setSettingsOpen(false); }} onForget={chat.forgetKey} />
            </div>
            <div className="text-sm">
              <button type="button" role="switch" aria-checked={chat.jevDown} disabled={liveBusy} onClick={() => chat.setJevDown(!chat.jevDown)} className={`${button} flex items-center gap-3`}>
                <span aria-hidden="true" className={`size-3 rounded-full ${chat.jevDown ? "bg-danger" : "bg-ink/20"}`} />
                Simulate Jev being down
              </button>
              <p className="mt-2 max-w-md leading-relaxed text-muted">Applies to live messages only. FirstRead holds the draft when a check fails. Recordings use their original results.</p>
            </div>
          </div>
        </section>
      )}

      <div className="flex min-h-[36rem] flex-1 flex-col gap-3 lg:min-h-0 lg:flex-row">
        <aside aria-label="Scenario browser" className="flex shrink-0 flex-col lg:w-64">
          <button type="button" className={`${button} flex items-center justify-between lg:hidden`} onClick={() => setScenariosOpen(!scenariosOpen)} aria-expanded={scenariosOpen} aria-controls="scenario-browser">
            <span>Recorded scenarios <span className="text-muted">({SCENARIOS.length})</span></span><span aria-hidden="true">{scenariosOpen ? "−" : "+"}</span>
          </button>
          <div id="scenario-browser" className={`${scenariosOpen ? "block" : "hidden"} mt-2 overflow-y-auto rounded-2xl border border-ink/10 bg-white/75 p-4 lg:mt-0 lg:block`}>
            <h2 className="text-sm font-semibold">Recorded scenarios</h2>
            <p className="mt-1 text-xs text-muted">Real runs. No API key needed.</p>
            <div className="mt-4 space-y-2">
              {[recommended, ...SCENARIOS.filter((s) => s.id !== recommended.id)].map((s) => (
                <button key={s.id} type="button" onClick={() => play(s)} disabled={liveBusy} aria-pressed={activeScenario?.id === s.id}
                  className={`w-full rounded-xl border p-3 text-left transition-colors disabled:opacity-40 ${activeScenario?.id === s.id ? "border-accent/35 bg-accent/[0.07]" : "border-transparent hover:border-line hover:bg-white"}`}>
                  {s.id === recommended.id && <span className="mb-1.5 block text-[0.7rem] font-semibold tracking-wider text-accent uppercase">Start here</span>}
                  <span className="block text-sm font-medium">{scenarioNames[s.id] ?? s.title}</span>
                  <span className="mt-1 block text-xs text-muted">{s.messages.length} turns{s.id === recommended.id ? " · Catch risk, replace, escalate" : " · Recorded"}</span>
                </button>
              ))}
            </div>
          </div>
          {rows.length > 0 && (
            <header aria-label="Conversation assessment" className="mt-3 rounded-2xl border border-ink/10 bg-white/75 p-4">
              <div className="hidden lg:block">
                <p className="mb-2 text-xs font-medium text-muted">Conversation assessment</p>
                {summary}
              </div>
              <details className="lg:hidden">
                <summary className={`cursor-pointer text-sm font-medium ${summaryUnavailable ? "text-danger" : "text-ink"}`}>
                  {summaryUnavailable ? "Assessment unavailable" : summaryPending ? "Assessment pending" : `Conversation: ${latestRisk?.level ?? "awaiting assessment"}`}
                </summary>
                <div className="mt-3">{summary}</div>
              </details>
            </header>
          )}
        </aside>

        <section aria-label="Conversation" className="flex min-h-[30rem] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-canvas shadow-[0_18px_60px_-30px_rgb(23_23_23/20%)] lg:min-h-0">
          <div className="shrink-0 border-b border-line px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-lg font-semibold tracking-tight">{activeScenario ? scenarioNames[activeScenario.id] ?? activeScenario.title : "FirstRead in action"}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chat.replay ? "bg-accent/10 text-accent" : "bg-raised text-muted"}`}>{chat.replay ? "Recorded run" : "Live playground"}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{chat.replay ? `Recorded ${recordedOn(chat.replay.recordedAt)} · ${rows.length} of ${chat.replay.scenario.messages.length} turns` : "Write a synthetic message. See what FirstRead lets through."}</p>
            {chat.replay && <ReplayControls chat={chat} canRunLive={canRunLive} onFollow={() => { following.current = true; }} />}
            {chat.playing && !chat.replay && <button type="button" className={`${button} mt-2`} onClick={chat.stopScenario}>Stop after this turn</button>}
            {chat.jevDown && !chat.replay && <p role="status" className="mt-2 text-sm font-medium text-danger">Outage simulation on. Live checks will fail closed.</p>}
          </div>

          <div ref={scroller} onScroll={() => {
            const el = scroller.current;
            if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {rows.length === 0 && activeScenario ? (
              <p className="px-6 py-10 text-sm text-muted" role="status">{chat.replay?.paused ? "Replay paused. Resume when you’re ready." : "Starting the scenario…"}</p>
            ) : rows.length === 0 ? (
              <div className="flex min-h-64 h-full flex-col items-center justify-center px-6 py-10 text-center">
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-accent/10 font-mono text-xl text-accent" aria-hidden="true">↳</span>
                <h2 className="text-2xl font-semibold tracking-tight">Watch one reply change.</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">A message signals distress. FirstRead checks the draft, intervenes when needed, and shows why.</p>
                <button type="button" onClick={() => play(recommended)} className="mt-6 min-h-11 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white hover:bg-ink/85">Play recommended scenario <span aria-hidden="true">→</span></button>
                <p className="mt-3 text-xs text-muted">{recommended.messages.length} turns · Recorded with real Jev checks</p>
              </div>
            ) : rows.map((e, i) => (
              <DemoTurn key={e.user.id} user={e.user} reply={e.reply} index={i} before={i === 0 ? null : levelAfter(rows[i - 1])} busy={chat.busy && i === rows.length - 1} recorded={Boolean(chat.replay)} onInspect={() => { following.current = false; chat.replay?.setPaused(true); }} />
            ))}
            {chat.error && <p role="alert" className="px-6 py-4 text-sm text-danger">{errorMessage(chat.error)}</p>}
          </div>

          <footer className="shrink-0 border-t border-line bg-margin px-4 py-3 sm:px-6">
            {chat.replay ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted">Inspect any turn to pause and see the evidence.</p>
                <button type="button" onClick={startLive} className={button}>Start a live chat <span aria-hidden="true">→</span></button>
              </div>
            ) : (
              <>
                <Composer chat={chat} />
                <p className="mt-2 text-xs text-muted">{chat.key ? "Using your OpenAI key." : serverKey ? `Demo key available · up to ${LIMITS.turnsPerChat} messages per conversation.` : "Add an OpenAI key in Settings to chat live."} Synthetic messages only.</p>
              </>
            )}
          </footer>
        </section>
      </div>
    </>
  );
}

const recordedOn = (iso: string) => new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
function ReplayControls({ chat, canRunLive, onFollow }: { chat: CompanionChatState; canRunLive: boolean; onFollow: () => void }) {
  const replay = chat.replay!;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {replay.finished ? <button type="button" onClick={() => chat.playScenario(replay.scenario)} className={button}>Play again</button> : (
        <>
          <button type="button" onClick={() => { if (replay.paused) onFollow(); replay.setPaused(!replay.paused); }} className={button}>{replay.paused ? "Resume" : "Pause"}</button>
          <button type="button" aria-pressed={replay.speed === 2} onClick={() => replay.setSpeed(replay.speed === 2 ? 1 : 2)} className={`${button} ${replay.speed === 2 ? "border-accent text-accent" : ""}`}>2× speed</button>
          <button type="button" onClick={() => { onFollow(); replay.skip(); }} className={button}>Skip to end</button>
        </>
      )}
      {canRunLive && <button type="button" onClick={() => chat.playLive(replay.scenario)} className={button}>Run live</button>}
      {replay.finished && <span className="text-xs text-muted">Replay complete</span>}
    </div>
  );
}
