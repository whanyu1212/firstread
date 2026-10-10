"use client";

import { motion } from "motion/react";
import iterations from "@/slides/data/iterations.json";
import { DURATION, useTransition } from "./motion";
import { Stat } from "./Stat";
import { useStep } from "./steps";

/**
 * Act 2, the iteration loop: BHH test recall at ELEVATED or above after each change, one change per
 * build step, with the false alarms it cost. From slides/data/iterations.json
 * (`pnpm --filter firstread export:iterations`), which rescores each saved run with its commit's
 * policy.
 */
const steps = iterations.steps;
const first = steps[0]!;
const last = steps.at(-1)!;
const pct = (v: number) => `${v.toFixed(1)}%`;
const points = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function Iterations() {
  const step = useStep();
  const t = useTransition();
  const { positive, negative } = last.cases;
  // The headline follows the build: the latest change shown, against where it started.
  const now = steps[Math.max(0, Math.min(step, steps.length) - 1)]!;

  return (
    <figure
      aria-label={`SI and self-harm messages caught at ELEVATED or above: ${steps.map((s) => `${s.change}, ${pct(s.recall)}, with ${pct(s.falseAlarms)} of no-risk messages flagged`).join("; ")}.`}
    >
      <Stat
        value={pct(now.recall)}
        label="of real risk caught"
        versus={
          now === first
            ? `With ${pct(first.falseAlarms)} of no-risk messages flagged.`
            : `Up from ${pct(first.recall)}. No-risk messages flagged: ${pct(first.falseAlarms)} → ${pct(now.falseAlarms)}.`
        }
      />
      <ol className="space-y-5" aria-hidden="true">
        {steps.map((s, i) => {
          const shown = step >= i + 1;
          const prev = steps[i - 1];
          return (
            <motion.li
              key={s.commit}
              initial={false}
              animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={shown ? t(DURATION.base) : t(0)}
            >
              {/* On a phone the numbers go under the change, so its name keeps the full width. */}
              <div className="grid gap-x-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <p>
                    <span className="text-lg font-semibold leading-tight">{s.change}</span>{" "}
                    <span className="font-mono text-xs whitespace-nowrap text-muted">
                      {s.commit} · {day(s.date)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{s.miss}</p>
                </div>
                <div className="mt-1 flex items-baseline gap-3 sm:mt-0 sm:block sm:text-right">
                  <p className="font-mono text-lg font-semibold">{pct(s.recall)}</p>
                  <p className="font-mono text-xs whitespace-nowrap text-muted">
                    false alarms {pct(s.falseAlarms)}
                    {prev && ` (${points(s.falseAlarms - prev.falseAlarms)})`}
                  </p>
                </div>
              </div>
              <div className="relative mt-2 h-3 rounded-full bg-line">
                <motion.span
                  className="absolute inset-y-0 left-0 origin-left rounded-full bg-series-1"
                  style={{ width: `${s.recall}%` }}
                  initial={false}
                  animate={{ scaleX: shown ? 1 : 0 }}
                  transition={shown ? t(DURATION.slow, 0.15) : t(0)}
                />
                {/* Where the step before stopped, so the gain shows as the bar passing it. */}
                {prev && (
                  <span className="absolute -inset-y-1 w-0.5 bg-ink/60" style={{ left: `${prev.recall}%` }} />
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
      <motion.figcaption
        className="mt-5 text-base text-muted"
        initial={false}
        animate={{ opacity: step >= 1 ? 1 : 0 }}
        transition={step >= 1 ? t(DURATION.base, 0.3) : t(0)}
      >
        BHH test split, {positive.toLocaleString("en")} suicidal-ideation and self-harm messages and{" "}
        {negative.toLocaleString("en")} with no risk, read at ELEVATED or above. Each saved run is rescored with the
        policy as it was at that commit.
      </motion.figcaption>
    </figure>
  );
}
