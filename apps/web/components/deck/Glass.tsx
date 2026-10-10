"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * A slide's figure on glass, as on the landing page. `inset` is for figures that bring their own
 * white panel (a conversation): the glass is a thin frame around it. Otherwise the figure sits on
 * the glass itself (a chart). With `at`, the glass appears with its first build step rather than
 * standing empty before it.
 */
export function Glass({ inset = false, at = 0, children }: { inset?: boolean; at?: number; children: ReactNode }) {
  const step = useStep();
  const t = useTransition();
  return (
    <motion.div
      className={inset ? "glass rounded-[20px] p-1.5 sm:rounded-[24px] sm:p-3" : "glass rounded-3xl p-6 sm:p-8"}
      initial={false}
      animate={{ opacity: step >= at ? 1 : 0 }}
      transition={t(DURATION.base)}
    >
      {children}
    </motion.div>
  );
}
