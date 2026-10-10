"use client";

import { motion } from "motion/react";
import type { Recording } from "@/lib/replay";
import recording from "@/slides/data/replay-crisis.json";
import { useTransition } from "./motion";
import { Stat } from "./Stat";
import { useStep } from "./steps";

/**
 * Slide 2, "fast enough": one recorded turn as a timeline, played at real speed. The user check
 * runs alongside the companion, so only the reply check adds to the wait.
 */
const timing = (recording as Recording).turns[0]!.data.timing!;
const draft = (timing.draftMs ?? 0) / 1000;
const check = (timing.checkMs ?? 0) / 1000;
const total = timing.totalMs / 1000;
const AXIS = Math.ceil(total);
const at = (sec: number) => `${(100 * sec) / AXIS}%`;

const BARS = [
  { label: "The companion writes its reply", from: 0, to: draft, firstread: false },
  { label: "FirstRead reads the message", from: 0, to: check, firstread: true },
  { label: "FirstRead checks the reply", from: draft, to: total, firstread: true },
];

export function TurnTimeline({ at: from }: { at: number }) {
  const step = useStep();
  const t = useTransition();
  const play = step >= from;

  return (
    <figure
      aria-label={`One turn: the companion took ${draft.toFixed(1)}s; FirstRead read the message in ${check.toFixed(1)}s at the same time, then checked the reply in ${(total - draft).toFixed(1)}s.`}
    >
      <Stat value={`+${(total - draft).toFixed(1)}s`} label="added by FirstRead" versus={`The reply went out at ${total.toFixed(1)}s; the companion alone took ${draft.toFixed(1)}s.`} />
      <div className="relative space-y-4">
        {BARS.map((b) => (
          <div key={b.label}>
            <p className={`mb-1.5 text-base ${b.firstread ? "text-ink" : "text-muted"}`}>{b.label}</p>
            <div className="relative h-4">
              <motion.span
                className={`absolute inset-y-0 rounded ${b.firstread ? "bg-series-1" : "bg-ink/15"}`}
                style={{ left: at(b.from) }}
                initial={false}
                animate={{ width: play ? at(b.to - b.from) : "0%" }}
                // Real speed: each bar grows over the time it took, from when it started.
                transition={play ? t(b.to - b.from, b.from) : t(0)}
              />
            </div>
          </div>
        ))}
        <motion.span
          className="absolute -top-1 bottom-0 border-l border-dashed border-ink"
          style={{ left: at(total) }}
          initial={false}
          animate={{ opacity: play ? 1 : 0 }}
          transition={play ? t(0.3, total) : t(0)}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-2 h-5 border-t border-line font-mono text-sm text-muted" aria-hidden="true">
        {Array.from({ length: AXIS + 1 }, (_, s) => (
          <span
            key={s}
            className={`absolute top-1 ${s === 0 ? "" : s === AXIS ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: at(s) }}
          >
            {s}s
          </span>
        ))}
      </div>
      <motion.figcaption
        className="mt-3 text-lg"
        initial={false}
        animate={{ opacity: play ? 1 : 0 }}
        transition={play ? t(0.4, total) : t(0)}
      >
        <span className="text-muted">A recorded turn, played at real speed.</span>
      </motion.figcaption>
    </figure>
  );
}
