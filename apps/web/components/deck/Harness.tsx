"use client";

import { DEFAULT_DEADLINE_MS } from "firstread/live";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { Recording } from "@/lib/replay";
import recording from "@/slides/data/replay-crisis.json";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * Act 2, "Jev in the harness": one turn through FirstRead (guard.ts), one stage per build step.
 * 1, the user check starts while the companion writes; 2, the reply check runs before anything is
 * shown; 3, one of three replies goes out; 4, the deadline, and failing closed. Times are from the
 * recorded crisis scenario: its first turn for the checks and the draft, the turn the companion
 * was stopped for the crisis reply.
 */
const rec = recording as Recording;
const first = rec.turns[0]!.data.timing!;
const stopped = rec.turns.find((t) => t.data.audit?.shortCircuit === "crisis")!.data.timing!;
const replyCheckMs = first.replyCheckMs ?? first.totalMs - (first.draftMs ?? 0);
const s = (ms: number) => `${(ms / 1000).toFixed(ms < 1000 ? 2 : 1)}s`;
const DEADLINE = `${DEFAULT_DEADLINE_MS / 1000}s`;

export function Harness() {
  const step = useStep();
  return (
    <figure aria-label="One turn through FirstRead: the message is checked while the companion writes, the draft is checked before it's shown, then the draft, a safe reply or the crisis reply goes out.">
      <div className="grid grid-cols-2 gap-x-5" aria-hidden="true">
        <Appear show={step >= 1} className="col-span-2">
          <p className="rounded-xl bg-user px-4 py-2 text-center text-lg">The person's message</p>
        </Appear>

        <Line show={step >= 1} className="h-5" />
        <Line show={step >= 1} className="h-5" />

        <Appear show={step >= 1}>
          <Node jev title="Jev reads the message" time={s(first.checkMs ?? 0)} badge={step >= 4 ? DEADLINE : null}>
            Starts at once, while the companion writes.
          </Node>
        </Appear>
        <Appear show={step >= 1} delay={0.15}>
          <Node title="The companion writes a draft" time={s(first.draftMs ?? 0)}>
            Its own model, its own tools.
          </Node>
        </Appear>

        {/* The first check's result waits beside the companion and the reply check. */}
        <Line show={step >= 3} className="row-span-3" />
        <Line show={step >= 2} className="h-5" />
        <Appear show={step >= 2}>
          <Node jev title="Jev reads the draft" time={s(replyCheckMs)} badge={step >= 4 ? DEADLINE : null}>
            Before anything is shown.
          </Node>
        </Appear>
        <Line show={step >= 3} className="h-5" />

        <Merge show={step >= 3} />
        <Line show={step >= 3} className="col-span-2 mb-1 h-3" />

        <div className="col-span-2 mt-0 grid gap-2 sm:grid-cols-2">
          <Appear show={step >= 3} delay={0.2}>
            <Outcome title="The draft, as written">Both checks pass.</Outcome>
          </Appear>
          <Appear show={step >= 3} delay={0.3}>
            <Outcome title="A safe reply instead">The draft falls short for the level, e.g. no support lines at ELEVATED.</Outcome>
          </Appear>
          <Appear show={step >= 3} delay={0.4}>
            <Outcome title="The crisis reply" crisis>
              At CRISIS the companion is stopped. In the recording it went out in {s(stopped.totalMs)}.
            </Outcome>
          </Appear>
          <Appear show={step >= 4} delay={0.2}>
            <Outcome title="A cautious reply" dashed>
              Jev doesn't answer within {DEADLINE} of the draft. The draft is never sent unchecked.
            </Outcome>
          </Appear>
        </div>
      </div>
      <Appear show={step >= 1} delay={0.4}>
        <figcaption className="mt-4 text-base text-muted">Times from a recorded turn. Blue is Jev.</figcaption>
      </Appear>
    </figure>
  );
}

function Appear({ show, delay = 0, className, children }: { show: boolean; delay?: number; className?: string; children: ReactNode }) {
  const t = useTransition();
  return (
    <motion.div
      className={className}
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={show ? t(DURATION.base, delay) : t(0)}
    >
      {children}
    </motion.div>
  );
}

/** A connector down the middle of its column. */
function Line({ show, className = "" }: { show: boolean; className?: string }) {
  const t = useTransition();
  return (
    <div className={`flex justify-center ${className}`}>
      <motion.span
        className="block w-0.5 origin-top bg-ink/25"
        initial={false}
        animate={{ scaleY: show ? 1 : 0 }}
        transition={show ? t(DURATION.base) : t(0)}
      />
    </div>
  );
}

/**
 * Both columns' lines joining into one, down to the replies. Its ends sit on the column centres:
 * a quarter of the width in from each side, less a quarter of the grid's gap-x-5 (1.25rem).
 */
function Merge({ show }: { show: boolean }) {
  const t = useTransition();
  return (
    <motion.div
      className="col-span-2 mx-[calc(25%-0.3125rem)] h-4 rounded-b-lg border-x-2 border-b-2 border-ink/25"
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={show ? t(DURATION.fast) : t(0)}
    />
  );
}

function Node({ jev = false, title, time, badge, children }: { jev?: boolean; title: string; time: string; badge?: string | null; children: ReactNode }) {
  const t = useTransition();
  return (
    <div className={`relative rounded-xl border bg-canvas px-4 py-3 ${jev ? "border-series-1 shadow-[inset_3px_0_0_var(--color-series-1)]" : "border-line"}`}>
      {/* On a phone the columns are too narrow for the title and time side by side. */}
      <p className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="text-base font-semibold leading-tight">{title}</span>
        <span className={`font-mono text-sm ${jev ? "text-series-1" : "text-muted"}`}>{time}</span>
      </p>
      <p className="mt-0.5 text-sm leading-snug text-muted">{children}</p>
      <motion.span
        className="absolute -top-3 right-3 rounded-full border border-dashed border-ink/50 bg-canvas px-2 font-mono text-xs"
        initial={false}
        animate={{ opacity: badge ? 1 : 0, scale: badge ? 1 : 0.8 }}
        transition={badge ? t(DURATION.fast, 0.1) : t(0)}
      >
        deadline {badge ?? DEADLINE}
      </motion.span>
    </div>
  );
}

function Outcome({ title, crisis = false, dashed = false, children }: { title: string; crisis?: boolean; dashed?: boolean; children: ReactNode }) {
  return (
    <div
      className={`h-full rounded-xl border px-4 py-2.5 ${dashed ? "border-dashed border-ink/40" : "border-line"} bg-canvas`}
      style={crisis ? { boxShadow: "inset 3px 0 0 var(--color-level-crisis)" } : undefined}
    >
      <p className="text-base font-semibold leading-tight">{title}</p>
      <p className="mt-0.5 text-sm leading-snug text-muted">{children}</p>
    </div>
  );
}
