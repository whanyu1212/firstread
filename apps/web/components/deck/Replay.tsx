"use client";

import type { RiskLevel } from "firstread";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type Recording, type Shown, finalStep, replaySchedule, replyMessage, userMessage } from "@/lib/replay";
import recording from "@/slides/data/replay-crisis.json";
import { CompanionReply, UserBubble, messageText } from "../CompanionChat";
import { LEVEL_COLOR } from "../levels";
import { MarginRule, TurnNote } from "../Margin";
import { useReduced } from "./motion";
import { useStep } from "./steps";

/**
 * The deck's last slide: a conversation recorded through the live pipeline, replayed at its real
 * timings with the demo's own components. It plays when the presenter reaches step `at`, not when
 * the slide mounts, and ends on the result: the turn the companion was stopped for, and how long
 * the crisis reply took. Each turn: the message, FirstRead's read when the user check answered,
 * then the reply when it went out. `action` sits in the footer beside Replay (the slide's link to
 * the demo).
 */
const rec = recording as Recording;
const schedule = replaySchedule(rec);
const FINAL = finalStep(rec);
const stopped = rec.turns.find((t) => t.data.audit?.shortCircuit === "crisis");
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
// On a phone each note folds under its message, and the rule runs beside both; from sm, notes sit
// in the margin beside their message, with the margin behind them: notes plus half the rule column.
const ROW = "grid grid-cols-[minmax(0,1fr)_2rem] sm:grid-cols-[minmax(0,1fr)_2.5rem_20rem]";
const levelAfter = (i: number): RiskLevel | null => (i < 0 ? null : (rec.turns[i]!.data.risk?.level ?? null));

export function Replay({ at, action }: { at: number; action?: ReactNode }) {
  const step = useStep();
  const reduced = useReduced();
  const [shown, setShown] = useState<Shown>({ turn: -1, phase: "done" });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = step >= at;

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (reduced) return setShown(FINAL);
    setShown({ turn: -1, phase: "done" });
    for (const { at, ...s } of schedule) timers.current.push(setTimeout(() => setShown(s), at));
  }, [reduced]);

  // Plays once the presenter reaches its step; going back before it clears it, ready to play again.
  useEffect(() => {
    if (started) play();
    else {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setShown({ turn: -1, phase: "done" });
    }
    return () => timers.current.forEach(clearTimeout);
  }, [started, play]);

  const finished = shown.turn === FINAL.turn && shown.phase === FINAL.phase;

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-canvas">
      {/* The finished replay, invisible, holds the figure at its final height from the start, so the
          slide doesn't grow as turns arrive; the playing one sits over it. */}
      <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
        <div className="invisible" aria-hidden="true" inert>
          <Conversation shown={FINAL} />
        </div>
        <div aria-live="polite">
          <Conversation shown={shown} />
        </div>
      </div>
      <figcaption className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line px-5 py-3">
        {finished && stopped ? (
          <p className="flex items-center gap-2.5 text-lg">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR.CRISIS }} aria-hidden="true" />
            <span>
              <strong className="font-semibold">Crisis read, companion stopped,</strong> and the crisis reply out in{" "}
              <span className="font-mono">{seconds(stopped.data.timing!.totalMs)}</span>.
            </span>
          </p>
        ) : (
          <p className="text-fig text-muted">
            Recorded {new Date(rec.recordedAt).toLocaleDateString("en-SG", { day: "numeric", month: "long" })} through the
            live pipeline: real Jev, the real companion, real timings.
          </p>
        )}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={play}
            disabled={!finished}
            className="h-10 rounded-md border border-line bg-canvas px-4 text-fig text-ink hover:bg-raised disabled:opacity-40"
          >
            Replay
          </button>
          {action}
        </div>
      </figcaption>
    </figure>
  );
}

/**
 * The conversation as far as `shown`: each turn, the margin rule in its level, and its note. Before
 * it plays, the empty conversation and margin, with what's about to play.
 */
function Conversation({ shown }: { shown: Shown }) {
  return (
    <div className="relative h-full">
      <div className="absolute inset-y-0 right-0 hidden w-[21.25rem] bg-margin sm:block" aria-hidden="true" />
      {shown.turn < 0 && (
        <p className={`relative ${ROW} h-full items-center`}>
          <span className="px-5 text-center text-lg text-muted">
            {rec.turns.length} messages, replayed at their recorded timings.
          </span>
        </p>
      )}
      {rec.turns.map((t, i) => {
        if (i > shown.turn) return null;
        const phase = i < shown.turn ? "done" : shown.phase;
        const reply = phase === "user" ? undefined : replyMessage(t, i, phase === "checked" ? "checked" : "done");
        return (
          <div key={i} className={`relative ${ROW}`}>
            <div className="space-y-2 py-3 pr-4 pl-5 text-lg">
              <UserBubble text={messageText(userMessage(t, i))} />
              {/* Only the companion's reply is cut short: a message bubble keeps its words. The demo's
                  small "waiting" line is set at the deck's 16px here, without changing the demo. */}
              <div className="[&_.text-sm]:text-fig [&_p]:line-clamp-2">
                <CompanionReply message={phase === "done" ? reply : undefined} pending={phase !== "done"} />
              </div>
            </div>
            <div className="max-sm:row-span-2">
              <MarginRule before={levelAfter(i - 1)} after={phase === "done" ? levelAfter(i) : null} />
            </div>
            <div className="pr-4 pb-3 pl-5 text-fig sm:px-4 sm:py-3">
              <TurnNote reply={reply} before={levelAfter(i - 1)} compact />
            </div>
          </div>
        );
      })}
    </div>
  );
}
