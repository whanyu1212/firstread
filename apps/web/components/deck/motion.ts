"use client";

import { type Transition, useReducedMotion } from "motion/react";

/**
 * The deck's motion settings, shared by every slide so it moves as one piece: one easing, three
 * durations. With reduced motion on, everything jumps to its final state.
 */
export const EASE = [0.2, 0.7, 0.2, 1] as const;
export const DURATION = { fast: 0.3, base: 0.6, slow: 1.2 } as const;

/** A transition for this visitor: instant when they've asked for reduced motion. */
export function useTransition() {
  const reduce = useReducedMotion();
  return (duration: number = DURATION.base, delay = 0): Transition =>
    reduce ? { duration: 0 } : { duration, delay, ease: EASE };
}

export function useReduced(): boolean {
  return useReducedMotion() ?? false;
}
