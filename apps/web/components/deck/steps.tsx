"use client";

import { motion } from "motion/react";
import { createContext, type ReactNode, useContext } from "react";
import { DURATION, useTransition } from "./motion";

/**
 * Build steps, like Keynote builds: a slide starts at step 0 and the presenter reveals the rest
 * one step at a time (DeckShell owns the keys). Anything with `at={n}` appears from step n on.
 */
export const StepContext = createContext(0);

export const useStep = () => useContext(StepContext);

/**
 * Shown from step `at` (until step `until`, if given), rising into place. It keeps its space in
 * the layout while hidden, so nothing jumps; stack two in one grid cell to swap them.
 */
export function Build({
  at,
  until,
  children,
  className,
}: {
  at: number;
  until?: number;
  children: ReactNode;
  className?: string;
}) {
  const step = useStep();
  const t = useTransition();
  const shown = step >= at && (until === undefined || step < until);
  return (
    <motion.div
      className={className}
      initial={false}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={t(DURATION.base)}
      aria-hidden={!shown}
      // Hidden steps can't be reached with Tab either.
      inert={!shown}
    >
      {children}
    </motion.div>
  );
}

/** A slide's points, revealed one per step. */
export function Points({ children }: { children: ReactNode }) {
  return <ul className="points">{children}</ul>;
}

export function Point({ at, title, children }: { at: number; title: string; children: ReactNode }) {
  const step = useStep();
  const t = useTransition();
  const shown = step >= at;
  return (
    <motion.li
      initial={false}
      animate={shown ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
      transition={t(DURATION.base)}
      aria-hidden={!shown}
      inert={!shown}
    >
      <strong>{title}</strong> {children}
    </motion.li>
  );
}

/** Text on the left, the slide's motion graphic on the right; stacked on narrow screens. */
export function Split({ visual, wide = false, children }: { visual: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid items-center gap-10 lg:gap-14 ${wide ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"}`}
    >
      <div className="slide-text">{children}</div>
      <div className="slide-visual min-w-0">{visual}</div>
    </div>
  );
}
