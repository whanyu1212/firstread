"use client";

import { motion } from "motion/react";
import { DURATION, useTransition } from "./motion";
import { MODELS, jev } from "./series";
import { useStep } from "./steps";

/**
 * Act 2, staying honest: what the evals don't cover yet, each marked with where it stands so the
 * list scans. GLM's numbers are from slides/data/bhh.json, the same run as the ROC and latency
 * charts.
 */
const glm = MODELS.find((m) => m.id === "glm")!;
const s = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

const ITEMS = [
  {
    status: "Unmeasured",
    title: "The reply check has no eval of its own.",
    detail: "Its cutoffs aren't measured on labelled replies yet. Late in a recovered conversation, it still replaces some calm ones.",
  },
  {
    status: "Held back",
    title: "Live conversations can over-escalate.",
    detail: "Demo scenarios whose live runs go above their labels are held back until that's fixed.",
  },
  {
    status: "No fallback",
    title: "When the gateway fails, FirstRead fails closed.",
    detail: "Safe, but the message goes unread. There's no fallback classifier yet.",
  },
  {
    status: "Close rival",
    title: `${glm.run.name} comes close.`,
    detail: `AUC ${glm.run.auc.toFixed(3)} against Jev's ${jev.run.auc.toFixed(3)}. Against it, Jev's lead is mostly speed: ${s(jev.run.latency.p50)} median against ${s(glm.run.latency.p50)}, ${(glm.run.latency.p50 / jev.run.latency.p50).toFixed(1)}× as fast.`,
  },
];

export function StillOpen({ at: from }: { at: number }) {
  const step = useStep();
  const t = useTransition();
  const shown = step >= from;
  return (
    <div>
      <p className="mb-4 text-xl font-semibold tracking-tight">Still open</p>
      <ul className="space-y-4">
        {ITEMS.map((item, i) => (
          <motion.li
            key={item.title}
            className="border-l-2 border-ink/20 pl-4"
            initial={false}
            animate={shown ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
            transition={shown ? t(DURATION.base, 0.1 + i * 0.12) : t(0)}
          >
            <p className="text-lg font-semibold leading-snug">
              <span className="mr-2 inline-block rounded-full border border-ink/25 px-2 align-[0.1em] text-fig font-medium text-ink/75">
                {item.status}
              </span>
              {item.title}
            </p>
            <p className="mt-0.5 text-fig leading-snug text-ink/75">{item.detail}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
