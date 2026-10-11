"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";
import styles from "./DeckStyles.module.css";

/**
 * A lightly ruled figure surface, with compact padding for figures with their own panel (`inset`).
 * With `at`, the surface appears with its first build step; with `until`, it disappears at that
 * step so panels can replace one another in a Stack without changing the surrounding layout.
 */
export function Glass({ inset = false, at = 0, until, children }: { inset?: boolean; at?: number; until?: number; children: ReactNode }) {
  const step = useStep();
  const t = useTransition();
  const shown = step >= at && (until === undefined || step < until);
  return (
    <motion.div
      className={`${styles.figure} ${inset ? styles.figureInset : ""}`}
      initial={false}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={t(DURATION.base)}
      aria-hidden={!shown}
      // A hidden panel's controls (a chart's focusable points) can't be reached or hovered.
      inert={!shown}
    >
      {children}
    </motion.div>
  );
}
