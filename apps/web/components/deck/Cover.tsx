"use client";

import { motion } from "motion/react";
import { Logo } from "../Logo";
import { DURATION, useTransition } from "./motion";

/**
 * The deck's first slide. The margin rule draws down beside the title and its dot fills, the way
 * FirstRead marks a turn it has read; the logo's F is the same rule and dot.
 */
export function Cover() {
  const t = useTransition();
  return (
    <div className="slide-cover flex flex-col gap-10 sm:gap-14">
      <Logo size="lg" />
      <div className="grid grid-cols-[3px_minmax(0,1fr)] gap-x-6 sm:gap-x-10">
        <span className="relative" aria-hidden="true">
          <motion.span
            className="absolute inset-0 origin-top rounded-full bg-accent"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={t(DURATION.slow, 0.2)}
          />
          <motion.span
            className="absolute top-3 left-1/2 size-4 -translate-x-1/2 rounded-full bg-accent sm:top-5 sm:size-5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={t(DURATION.fast, 0.2 + DURATION.slow)}
          />
        </span>
        <div>
          <h1 className="text-5xl leading-[1.02] font-semibold tracking-[-0.035em] sm:text-7xl xl:text-8xl">
            What would Jev do?
            <br />
            Read every turn first.
          </h1>
          <p className="mt-8 max-w-[30em] text-xl leading-relaxed text-ink/75 sm:text-2xl">
            FirstRead is a safety layer that reads every turn of a mental health companion: the person's message, and
            the companion's draft before it's sent.
          </p>
        </div>
      </div>
      <p className="glass self-start rounded-2xl px-4 py-2 text-sm sm:rounded-full sm:text-base">
        Built for <span className="font-semibold">What Would Jev Do?</span>, AdaL's online hackathon, October 6–11,
        2026
      </p>
    </div>
  );
}
