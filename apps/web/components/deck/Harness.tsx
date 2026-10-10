"use client";

import { DEFAULT_DEADLINE_MS } from "firstread/live";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { Recording } from "@/lib/replay";
import recording from "@/slides/data/replay-crisis.json";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * Act 2, "Jev in the harness": one recorded turn through FirstRead (guard.ts) on a real time axis.
 * Jev reads the message from the moment it arrives, while the companion writes; Jev reads the
 * draft once it's ready; then one reply goes out. The deadline runs from the draft being ready,
 * as in guard.ts, so the axis runs to the draft plus the deadline from the start and nothing
 * rescales when it appears.
 *
 * Steps (from the slide): `at`, the message check beside the draft; `draftAt`, the reply check;
 * `outcomesAt`, the replies that can go out; `deadlineAt`, the deadline and failing closed. Times
 * are from the recorded crisis scenario: its first turn for the checks and the draft, the turn the
 * companion was stopped for the crisis reply.
 */
const rec = recording as Recording;
const turn = rec.turns[0]!.data.timing!;
const stopped = rec.turns.find((t) => t.data.audit?.shortCircuit === "crisis")!.data.timing!;
const CHECK = turn.checkMs!;
const DRAFT = turn.draftMs!;
const REPLY_CHECK = turn.replyCheckMs ?? turn.totalMs - DRAFT;
const OUT = DRAFT + REPLY_CHECK;
const DEADLINE = DRAFT + DEFAULT_DEADLINE_MS;
const AXIS_MS = Math.ceil(DEADLINE / 1000) * 1000;
const TICKS = Array.from({ length: AXIS_MS / 1000 + 1 }, (_, i) => i * 1000);
const at = (ms: number) => `${(100 * ms) / AXIS_MS}%`;
const span = (from: number, to: number) => ({ left: at(from), width: at(to - from) });
const s = (ms: number) => `${(ms / 1000).toFixed(ms < 1000 ? 2 : 1)}s`;

type Steps = { at: number; draftAt: number; outcomesAt: number; deadlineAt: number };

export function Harness({ at: first, draftAt, outcomesAt, deadlineAt }: Steps) {
  const step = useStep();
  const t = useTransition();
  const show = { check: step >= first, reply: step >= draftAt, outcomes: step >= outcomesAt, deadline: step >= deadlineAt };

  return (
    <figure
      aria-label={`One recorded turn: Jev read the message in ${s(CHECK)} while the companion wrote its draft in ${s(DRAFT)}; Jev read the draft in ${s(REPLY_CHECK)}, and the reply went out at ${s(OUT)}. Both checks must answer within ${s(DEFAULT_DEADLINE_MS)} of the draft being ready, or FirstRead fails closed.`}
    >
      <div className="relative" aria-hidden="true">
        {/* Drawn down through the lanes, behind the bars: the message arriving, the reply going out,
            and the window both checks must answer in once the draft is ready. On a phone, where
            labels sit between the lanes, the caption says it instead. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 left-0 max-lg:hidden lg:left-[19.5rem]">
          <Moment show={show.check} left={at(0)} />
          <Moment show={show.reply} left={at(OUT)} strong delay={0.3} />
          <motion.div
            className="absolute top-0 bottom-8 border-r-2 border-dashed border-ink/40 bg-ink/[0.04]"
            style={span(DRAFT, DEADLINE)}
            initial={false}
            animate={{ opacity: show.deadline ? 1 : 0 }}
            transition={show.deadline ? t(DURATION.base) : t(0)}
          >
          </motion.div>
        </div>

        {/* Too crowded on a phone, where the caption says it instead. */}
        <Row className="h-7" wideOnly>
          <Marker show={show.check} left={at(0)}>
            Message arrives
          </Marker>
          <Marker show={show.reply} left={at(OUT)} align="end" delay={0.3}>
            Reply out at {s(OUT)}
          </Marker>
          <Marker show={show.deadline} left={at(DEADLINE)} align="end">
            <span className="font-semibold text-ink">Deadline:</span> {s(DEFAULT_DEADLINE_MS)} from the draft
          </Marker>
        </Row>

        <Lane show={show.check} jev title="Jev reads the message" note={`Done ${s(DRAFT - CHECK)} before the draft is ready`}>
          <Bar show={show.check} from={0} to={CHECK} jev label={s(CHECK)} />
        </Lane>
        <Lane show={show.check} title="The companion writes its draft" note="Its own model, its own tools" delay={0.15}>
          <Bar show={show.check} from={0} to={DRAFT} label={s(DRAFT)} inside delay={0.15} />
        </Lane>
        <Lane show={show.reply} jev title="Jev reads the draft" note="Before anything is shown">
          <Bar show={show.reply} from={DRAFT} to={OUT} jev label={s(REPLY_CHECK)} />
        </Lane>

        <Row className="h-8 border-t border-ink/20">
          {TICKS.map((ms) => (
            <span
              key={ms}
              className={`absolute top-1.5 font-mono text-fig text-muted ${ms === 0 ? "" : ms === AXIS_MS ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: at(ms) }}
            >
              {ms / 1000}s
            </span>
          ))}
        </Row>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        <Appear show={show.outcomes}>
          <Outcome title="The draft, as written">Both checks pass.</Outcome>
        </Appear>
        <Appear show={show.outcomes} delay={0.1}>
          <Outcome title="A safe reply instead">The draft falls short for the level, e.g. no support lines at ELEVATED.</Outcome>
        </Appear>
        <Appear show={show.outcomes} delay={0.2}>
          <Outcome title="The crisis reply" crisis>
            At CRISIS the companion is stopped. In the recording it went out in {s(stopped.totalMs)}.
          </Outcome>
        </Appear>
        <Appear show={show.deadline} delay={0.2}>
          <Outcome title="A cautious reply" dashed>
            No answer within {s(DEFAULT_DEADLINE_MS)} of the draft, so the draft is never sent unchecked. Try “Simulate Jev being
            down” in the demo.
          </Outcome>
        </Appear>
      </div>

      <motion.figcaption
        className="mt-4 text-fig text-muted"
        initial={false}
        animate={{ opacity: show.check ? 1 : 0 }}
        transition={show.check ? t(DURATION.base, 0.4) : t(0)}
      >
        One recorded turn, to scale: the reply went out at {s(OUT)}. Blue is Jev.
        {show.deadline && ` Shaded: the ${s(DEFAULT_DEADLINE_MS)} both checks have once the draft is ready.`}
      </motion.figcaption>
    </figure>
  );
}

/** A row with no label, lined up with the lanes' tracks: the moments above them, the axis below. */
function Row({ className, wideOnly = false, children }: { className: string; wideOnly?: boolean; children: ReactNode }) {
  return (
    <div className={`relative grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-x-6 ${wideOnly ? "max-lg:hidden" : ""}`}>
      <span className="max-lg:hidden" />
      <div className={`relative ${className}`}>{children}</div>
    </div>
  );
}

/** A moment, as a line down through the lanes. */
function Moment({ show, left, strong = false, delay = 0 }: { show: boolean; left: string; strong?: boolean; delay?: number }) {
  const t = useTransition();
  return (
    <motion.span
      className={`absolute inset-y-0 w-px ${strong ? "bg-ink/50" : "bg-ink/20"}`}
      style={{ left }}
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={show ? t(DURATION.base, delay) : t(0)}
    />
  );
}

/** One lane: what runs, and its bar on the time axis. */
function Lane({ show, jev = false, title, note, delay = 0, children }: { show: boolean; jev?: boolean; title: string; note: string; delay?: number; children: ReactNode }) {
  const t = useTransition();
  return (
    <motion.div
      className="relative grid items-center lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-x-6"
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={show ? t(DURATION.base, delay) : t(0)}
    >
      <p className="pt-2 leading-tight lg:py-2">
        <span className={`block text-lg font-semibold ${jev ? "text-series-1" : ""}`}>{title}</span>
        <span className="block text-fig text-muted">{note}</span>
      </p>
      <div className="relative h-14">{children}</div>
    </motion.div>
  );
}

/** A bar from `from` to `to`, its duration after its end, or (`inside`, for a long bar) within it. */
function Bar({ show, from, to, jev = false, label, inside = false, delay = 0 }: { show: boolean; from: number; to: number; jev?: boolean; label: string; inside?: boolean; delay?: number }) {
  const t = useTransition();
  return (
    <>
      <motion.span
        className={`absolute top-1/2 h-6 -translate-y-1/2 origin-left rounded-md ${jev ? "bg-series-1" : "bg-ink/15"}`}
        style={span(from, to)}
        initial={false}
        animate={{ scaleX: show ? 1 : 0 }}
        transition={show ? t(DURATION.slow, delay) : t(0)}
      />
      <motion.span
        className={`absolute top-1/2 -translate-y-1/2 font-mono text-fig whitespace-nowrap ${inside ? "-translate-x-full pr-2.5 text-ink" : "ml-3"} ${jev ? "text-series-1" : inside ? "" : "text-muted"}`}
        style={{ left: at(to) }}
        initial={false}
        animate={{ opacity: show ? 1 : 0 }}
        transition={show ? t(DURATION.fast, delay + DURATION.slow * 0.8) : t(0)}
      >
        {label}
      </motion.span>
    </>
  );
}

/** A moment's label above the lanes: from its line rightwards, or (`end`) ending at it. */
function Marker({ show, left, align = "start", delay = 0, children }: { show: boolean; left: string; align?: "start" | "end"; delay?: number; children: ReactNode }) {
  const t = useTransition();
  return (
    <motion.span
      className={`absolute bottom-0 text-fig whitespace-nowrap text-muted ${align === "end" ? "-translate-x-full pr-2" : "pl-2"}`}
      style={{ left }}
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={show ? t(DURATION.base, delay) : t(0)}
    >
      {children}
    </motion.span>
  );
}

function Appear({ show, delay = 0, children }: { show: boolean; delay?: number; children: ReactNode }) {
  const t = useTransition();
  return (
    <motion.div
      className="h-full"
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={show ? t(DURATION.base, delay) : t(0)}
    >
      {children}
    </motion.div>
  );
}

function Outcome({ title, crisis = false, dashed = false, children }: { title: string; crisis?: boolean; dashed?: boolean; children: ReactNode }) {
  return (
    <div
      className={`h-full rounded-xl border bg-canvas px-4 py-3 ${dashed ? "border-dashed border-ink/40" : "border-line"}`}
      style={crisis ? { boxShadow: "inset 3px 0 0 var(--color-level-crisis)" } : undefined}
    >
      <p className="text-lg font-semibold leading-tight">{title}</p>
      <p className="mt-1 text-fig leading-snug text-muted">{children}</p>
    </div>
  );
}
