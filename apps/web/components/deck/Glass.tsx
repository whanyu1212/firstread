"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * A slide's figure on glass, as on the landing page. `inset` is for figures that bring their own
 * white panel (a conversation): the glass is a thin frame around it. Otherwise the figure sits on
 * the glass itself (a chart), nearly opaque so the glow behind doesn't tint the marks. With `at`,
 * the glass appears with its first build step rather than standing empty before it; with `until`,
 * it goes at that step, for panels that replace one another in a Stack. The fade is on the glass
 * itself: a fading parent would turn its backdrop blur off until the fade ends.
 */
export function Glass({ inset = false, at = 0, until, children }: { inset?: boolean; at?: number; until?: number; children: ReactNode }) {
  const step = useStep();
  const t = useTransition();
  const shown = step >= at && (until === undefined || step < until);
  return (
    <motion.div
      className={inset ? "glass rounded-[20px] p-1.5 sm:rounded-[24px] sm:p-3" : "glass rounded-3xl p-6 sm:p-8"}
      style={inset ? undefined : { background: "rgb(255 255 255 / 0.94)" }}
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
