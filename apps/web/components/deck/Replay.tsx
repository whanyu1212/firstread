"use client";

import type { RiskLevel } from "firstread";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Recording, replyMessage, userMessage } from "@/lib/replay";
import recording from "@/slides/data/replay-crisis.json";
import { CompanionReply, UserBubble, messageText } from "../CompanionChat";
import { MarginRule, NowSummary, TurnNote } from "../Margin";
import { useReduced } from "./motion";

/**
 * The deck's last slide: a conversation recorded through the live pipeline, replayed at its real
 * timings with the demo's own components. Each turn: the message, FirstRead's read when the user
 * check answered, then the reply when it went out.
 */
const rec = recording as Recording;
/** Time to read each reply before the next message arrives. */
const PAUSE_MS = 1800;
// Narrower notes on a phone; the margin behind them matches: notes plus half the rule column.
const ROW = "grid grid-cols-[minmax(0,1fr)_2rem_9rem] sm:grid-cols-[minmax(0,1fr)_2.5rem_17rem]";

type Shown = { turn: number; phase: "user" | "checked" | "done" };

export function Replay() {
  const reduced = useReduced();
  const [shown, setShown] = useState<Shown>({ turn: -1, phase: "done" });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (reduced) return setShown({ turn: rec.turns.length - 1, phase: "done" });
    let at = 400;
    rec.turns.forEach((t, i) => {
      const { checkMs, totalMs } = t.data.timing!;
      const schedule = (ms: number, s: Shown) => timers.current.push(setTimeout(() => setShown(s), ms));
      schedule(at, { turn: i, phase: "user" });
      if (checkMs !== null && checkMs < totalMs) schedule(at + checkMs, { turn: i, phase: "checked" });
      schedule(at + Math.max(totalMs, 250), { turn: i, phase: "done" });
      at += Math.max(totalMs, 250) + PAUSE_MS;
    });
  }, [reduced]);

  useEffect(() => {
    play();
    return () => timers.current.forEach(clearTimeout);
  }, [play]);

  const levelAfter = (i: number): RiskLevel | null => (i < 0 ? null : (rec.turns[i]!.data.risk?.level ?? null));
  const latestDone = shown.phase === "done" ? shown.turn : shown.turn - 1;
  const finished = shown.turn === rec.turns.length - 1 && shown.phase === "done";

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="relative">
        <div className="absolute inset-y-0 right-0 w-[10rem] bg-margin sm:w-[18.25rem]" aria-hidden="true" />
        <div className={`relative ${ROW} border-b border-line`}>
          <p className="self-center px-5 py-4 text-sm text-muted">
            Recorded {new Date(rec.recordedAt).toLocaleDateString("en-SG", { day: "numeric", month: "long" })} through the
            live pipeline: real Jev, the real companion, real timings.
          </p>
          <span />
          <div className="px-4 py-4">
            <NowSummary risk={latestDone >= 0 ? rec.turns[latestDone]!.data.risk : undefined} waiting />
          </div>
        </div>
        <div className="relative" aria-live="polite">
          {rec.turns.map((t, i) => {
            if (i > shown.turn) return null;
            const phase = i < shown.turn ? "done" : shown.phase;
            const reply = phase === "user" ? undefined : replyMessage(t, i, phase === "checked" ? "checked" : "done");
            const user = userMessage(t, i);
            return (
              <div key={i} className={ROW}>
                <div className="space-y-3 py-4 pr-4 pl-5 [&_p]:line-clamp-2">
                  <UserBubble text={messageText(user)} />
                  <CompanionReply message={phase === "done" ? reply : undefined} pending={phase !== "done"} />
                </div>
                <MarginRule before={levelAfter(i - 1)} after={phase === "done" ? levelAfter(i) : null} />
                <div className="px-4 py-4 text-[0.95rem]">
                  <TurnNote reply={reply} before={levelAfter(i - 1)} compact />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="flex items-center justify-between gap-4 border-t border-line px-5 py-3 text-sm text-muted">
        <span>{rec.title}, as it happened.</span>
        <button
          type="button"
          onClick={play}
          disabled={!finished}
          className="h-8 rounded-md border border-line bg-canvas px-3 text-ink hover:bg-raised disabled:opacity-40"
        >
          Replay
        </button>
      </figcaption>
    </figure>
  );
}
