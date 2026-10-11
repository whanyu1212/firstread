"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ChatMessage, JEV_DOWN_HEADER, OPENAI_KEY_HEADER } from "@/lib/chat";
import { RECORDINGS } from "@/lib/recordings";
import { type Recording, type Shown, finalStep, messagesAt, replaySchedule } from "@/lib/replay";
import type { Scenario } from "@/lib/scenarios";
import { useOpenAIKey } from "./OpenAIKeyField";

/** Pause between a reply and the next scripted message, so the audience can read it. */
const SCENARIO_PAUSE_MS = 1500;
/** How often a replay checks whether its next moment has come. */
const REPLAY_TICK_MS = 50;
/** A replay's first message shows at once, so the click visibly starts it. */
// Leave time to notice the decision and open its evidence; the deck keeps its own faster pace.
const scheduleOf = (rec: Recording) => replaySchedule(rec, { startMs: 0, pauseMs: 6000 });

/** A recording being replayed: no network, no key. `play` keeps each play's message ids apart. */
type Replay = { scenario: Scenario; rec: Recording; play: string; shown: Shown | null; speed: 1 | 2; stopped: boolean; paused: boolean };

/**
 * The demo's chat state, shared by the chat and the risk panel: the visitor's key, the "Jev down"
 * switch, a "new conversation" reset, and scripted scenarios. A scenario replays its recording
 * (lib/recordings.ts) without a key; `playLive` sends it through the chat route one message at a
 * time instead.
 */
export function useCompanionChat() {
  const { key, setKey, forget } = useOpenAIKey();
  const [jevDown, setJevDown] = useState(false);
  // The transport lives for the component's lifetime, so it reads these through a ref.
  const live = useRef({ key, jevDown });
  live.current = { key, jevDown };
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        headers: (): Record<string, string> => ({
          ...(live.current.key ? { [OPENAI_KEY_HEADER]: live.current.key } : {}),
          ...(live.current.jevDown ? { [JEV_DOWN_HEADER]: "1" } : {}),
        }),
        // Only the new message: the history FirstRead and the companion use is kept on the server.
        prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, message: messages.at(-1) } }),
      }),
  );
  // A new id is a new conversation, here and on the server (a fresh risk state).
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const chat = useChat<ChatMessage>({ id: chatId, transport });
  const busy = chat.status === "submitted" || chat.status === "streaming";

  const [scenario, setScenario] = useState<{ scenario: Scenario; next: number } | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  // A message typed over a replay, sent once the fresh conversation exists (see below).
  const [pending, setPending] = useState<string | null>(null);
  const reduce = useReducedMotion() ?? false;

  const newConversation = useCallback(() => {
    setScenario(null);
    setReplay(null);
    setChatId(crypto.randomUUID());
  }, []);

  const playLive = useCallback((s: Scenario) => {
    setReplay(null);
    setChatId(crypto.randomUUID());
    setScenario({ scenario: s, next: 0 });
  }, []);

  const playScenario = useCallback(
    (s: Scenario) => {
      const rec = RECORDINGS[s.id];
      if (!rec) return playLive(s);
      setScenario(null);
      setChatId(crypto.randomUUID());
      // With reduced motion on, the replay jumps to its end, as "Skip to end" does.
      setReplay({ scenario: s, rec, play: `${Date.now()}-`, shown: reduce ? finalStep(rec) : null, speed: 1, stopped: reduce, paused: false });
    },
    [playLive, reduce],
  );

  // Advance a replay through its recorded timings, at its speed. Virtual time keeps the place
  // when the speed changes mid-play.
  const replayKey = replay && !replay.stopped && !replay.paused ? replay.play : null;
  const speed = replay?.speed ?? 1;
  const clock = useRef({ virtual: 0, last: 0 });
  useEffect(() => {
    if (!replayKey) return;
    clock.current.last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      clock.current.virtual += (now - clock.current.last) * speed;
      clock.current.last = now;
      setReplay((r) => {
        if (!r || r.play !== replayKey) return r;
        const steps = scheduleOf(r.rec);
        const reached = steps.filter((st) => st.at <= clock.current.virtual).at(-1);
        const done = steps.at(-1)!.at <= clock.current.virtual;
        const shown = reached ? { turn: reached.turn, phase: reached.phase } : null;
        if (shown?.turn === r.shown?.turn && shown?.phase === r.shown?.phase && !done) return r;
        return { ...r, shown, stopped: done };
      });
    }, REPLAY_TICK_MS);
    return () => clearInterval(id);
  }, [replayKey, speed]);
  // A new play starts its clock from zero.
  useEffect(() => {
    if (replay?.play) clock.current.virtual = 0;
  }, [replay?.play]);

  const replayFinished = replay !== null && (replay.stopped || (replay.shown?.turn === replay.rec.turns.length - 1 && replay.shown.phase === "done"));

  // The same array until the replay moves on, so effects keyed on messages (auto-scroll) don't
  // fire on unrelated re-renders.
  const replayMessages = useMemo(
    () => (replay?.shown ? messagesAt(replay.rec, replay.shown, replay.play) : []),
    [replay?.rec, replay?.shown, replay?.play],
  );

  const send = chat.sendMessage;
  // Typing over a replay starts a fresh conversation, since the server has none of the replayed
  // turns. The message goes once the new chat exists, i.e. after the render that changed the id.
  useEffect(() => {
    if (pending === null || replay) return;
    send({ text: pending });
    setPending(null);
  }, [pending, replay, send]);
  const sendMessage: typeof send = (message, options) => {
    if (replay && message && "text" in message && typeof message.text === "string") {
      setReplay(null);
      setChatId(crypto.randomUUID());
      setPending(message.text);
      return Promise.resolve();
    }
    return send(message, options);
  };
  // Send the next scripted message once the previous reply is in.
  useEffect(() => {
    if (!scenario || busy) return;
    if (chat.error) return setScenario(null);
    const { scenario: s, next } = scenario;
    if (next >= s.messages.length) return setScenario(null);
    const timer = setTimeout(
      () => {
        send({ text: s.messages[next]! });
        setScenario({ scenario: s, next: next + 1 });
      },
      next === 0 ? 0 : SCENARIO_PAUSE_MS,
    );
    return () => clearTimeout(timer);
  }, [scenario, busy, chat.error, send]);

  return {
    ...chat,
    messages: replay ? replayMessages : chat.messages,
    sendMessage,
    busy: replay ? !replayFinished : busy,
    key,
    setKey,
    forgetKey: forget,
    jevDown,
    setJevDown,
    newConversation,
    playScenario,
    playLive,
    playing: scenario?.scenario ?? (replay && !replayFinished ? replay.scenario : null),
    stopScenario: () => {
      setScenario(null);
      // Stopping a replay lets the turn on screen finish, as a live stop does; before its first
      // message there's nothing to keep.
      setReplay((r) => (!r || !r.shown ? null : { ...r, shown: { turn: r.shown.turn, phase: "done" }, stopped: true }));
    },
    /** The replay on screen, if any: what it is, its speed, and the controls for it. */
    replay: replay && {
      scenario: replay.scenario,
      recordedAt: replay.rec.recordedAt,
      speed: replay.speed,
      finished: replayFinished,
      paused: replay.paused,
      setPaused: (paused: boolean) => setReplay((r) => (r ? { ...r, paused } : r)),
      setSpeed: (s: 1 | 2) => setReplay((r) => (r ? { ...r, speed: s } : r)),
      /**
       * Recorded seconds since a turn's message appeared, read from the replay's own clock, so a
       * speed change only speeds up what comes after it.
       */
      elapsedSince: (turn: number) => {
        const start = scheduleOf(replay.rec).find((st) => st.turn === turn && st.phase === "user")?.at ?? 0;
        const running = !replay.stopped && !replay.paused ? (performance.now() - clock.current.last) * replay.speed : 0;
        return Math.max(0, clock.current.virtual + running - start) / 1000;
      },
      skip: () => setReplay((r) => (r ? { ...r, shown: finalStep(r.rec), stopped: true } : r)),
    },
  };
}

export type CompanionChatState = ReturnType<typeof useCompanionChat>;
