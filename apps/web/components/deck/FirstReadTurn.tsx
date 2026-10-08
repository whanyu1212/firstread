"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { ChatData } from "@/lib/chat";
import type { Recording } from "@/lib/replay";
import recording from "@/slides/data/replay-crisis.json";
import { LEVEL_COLOR, LEVEL_LABEL } from "../levels";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * Slide 1: one turn, as FirstRead reads it. Step 1, the user's message arrives and FirstRead
 * reads it; step 2, the companion's draft is held, checked, and the safe reply goes out instead.
 * Every value is from turn 1 of the recorded crisis scenario.
 */
const turn = (recording as Recording).turns[0]!;
const check = turn.data.check as Extract<ChatData["check"], { ok: true }>;
const audit = turn.data.audit!;
const timing = turn.data.timing!;
const replyCheckMs = timing.totalMs - (timing.draftMs ?? 0);
const s = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

// On a phone each note folds under its message (a notes column leaves the messages too narrow);
// from sm, notes sit in the margin beside them, with the margin behind them: notes plus half the
// rule column.
const ROW = "grid grid-cols-[minmax(0,1fr)_2rem] items-start sm:grid-cols-[minmax(0,1fr)_2.5rem_14rem]";

export function FirstReadTurn() {
  const step = useStep();
  const t = useTransition();
  const level = LEVEL_COLOR[check.level];

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="relative">
        {/* The margin FirstRead writes in, from the middle of the rule. */}
        <div className="absolute inset-y-0 right-0 hidden w-[15.25rem] bg-margin sm:block" aria-hidden="true" />

        {/* The user's message, and FirstRead reading it. */}
        <div className={`relative ${ROW} pt-6`}>
          <motion.p
            className="mr-4 ml-auto max-w-[85%] rounded-xl bg-user px-4 py-2.5 text-lg"
            initial={false}
            animate={step >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
            transition={t(DURATION.base)}
          >
            {turn.user}
          </motion.p>
          <Node show={step >= 1} color={level} delay={0.5 + check.ms / 1000} />
          <Note show={step >= 1} delay={0.5 + check.ms / 1000}>
            <span className="font-semibold">Your message: {LEVEL_LABEL[check.level]}</span>
            <span className="block text-sm text-muted">Read in {s(check.ms)}, while the companion writes</span>
          </Note>
        </div>

        {/* The rule between the two checks, in the level the message set. */}
        <div className={`relative ${ROW}`} aria-hidden="true">
          <span />
          <motion.span
            className="mx-auto block h-16 w-[3px] origin-top"
            style={{ background: level }}
            initial={false}
            animate={{ scaleY: step >= 2 ? 1 : 0 }}
            transition={t(DURATION.base)}
          />
          <span />
        </div>

        {/* The companion's draft: held, checked, then replaced. */}
        <div className={`relative ${ROW} pb-6`}>
          <div className="ml-4 max-w-[85%]">
            <motion.div
              initial={false}
              animate={step >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={t(DURATION.base)}
            >
              <Draft replaced={step >= 2} delay={0.9 + replyCheckMs / 1000} reply={turn.reply} />
            </motion.div>
          </div>
          <Node show={step >= 2} color={level} delay={0.9 + replyCheckMs / 1000} />
          <Note show={step >= 2} delay={0.9 + replyCheckMs / 1000}>
            <span className="font-semibold">The draft: {audit.action === "replace" ? "replaced" : "sent"}</span>
            <span className="block text-sm text-muted">
              At {LEVEL_LABEL[audit.level]} a reply must point to support (0.5 or more); this one scored{" "}
              {audit.replySignals?.offers_support_resources.toFixed(2)}. Checked in {s(replyCheckMs)}.
            </span>
          </Note>
        </div>
      </div>
      <figcaption className="border-t border-line px-5 py-3 text-sm text-muted">
        A recorded turn: the companion's draft never reached the person.
      </figcaption>
    </figure>
  );
}

/** A dot on the rule: a ring while FirstRead reads, filled once it has answered. */
function Node({ show, color, delay }: { show: boolean; color: string; delay: number }) {
  const t = useTransition();
  return (
    <span className="relative mx-auto mt-3 block size-4" aria-hidden="true">
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-muted bg-canvas"
        initial={false}
        animate={{ opacity: show ? 1 : 0 }}
        transition={t(DURATION.fast)}
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: color }}
        initial={false}
        animate={show ? { scale: 1, opacity: 1 } : { scale: 0.2, opacity: 0 }}
        transition={show ? t(DURATION.fast, delay) : t(0)}
      />
    </span>
  );
}

function Note({ show, delay, children }: { show: boolean; delay: number; children: ReactNode }) {
  const t = useTransition();
  return (
    <motion.p
      className="px-4 pt-1.5 text-base leading-snug max-sm:col-start-1 max-sm:row-start-2 max-sm:mx-4 max-sm:mt-2 max-sm:rounded-lg max-sm:bg-margin max-sm:py-2"
      initial={false}
      animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
      transition={show ? t(DURATION.base, delay) : t(0)}
    >
      {children}
    </motion.p>
  );
}

/** The draft as skeleton lines while it's held; once checked, the reply that went out instead. */
function Draft({ replaced, delay, reply }: { replaced: boolean; delay: number; reply: string }) {
  const t = useTransition();
  const first = reply.split(/(?<=[.!?])\s/)[0];
  return (
    // Both states share one grid cell, so the row is as tall as the taller one: on a narrow column
    // the reply wraps past the skeleton's height and would otherwise spill over what's below.
    <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
      <motion.div
        className="space-y-2 self-start rounded-xl border border-dashed border-muted/60 px-4 py-3"
        initial={false}
        animate={{ opacity: replaced ? 0 : 1 }}
        transition={replaced ? t(DURATION.fast, delay) : t(0)}
        aria-hidden="true"
      >
        <p className="text-sm text-muted">The companion's draft, held</p>
        <span className="block h-2.5 w-11/12 rounded bg-raised" />
        <span className="block h-2.5 w-3/4 rounded bg-raised" />
      </motion.div>
      <motion.p
        className="text-lg leading-snug"
        initial={false}
        animate={{ opacity: replaced ? 1 : 0 }}
        transition={replaced ? t(DURATION.base, delay + 0.2) : t(0)}
      >
        {first} …
      </motion.p>
    </div>
  );
}
