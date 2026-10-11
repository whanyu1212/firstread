"use client";

import { motion } from "motion/react";
import { DURATION, useTransition } from "./motion";
import { MODELS, type Model, jev, others } from "./series";
import { Stat } from "./Stat";
import { useStep } from "./steps";
import styles from "./AppendixFigures.module.css";

/**
 * Slide 3: how long one check takes, for Jev and the four general models, on one time axis: a bar
 * from the 10th to the 90th percentile, a dot at the median, and the user check's 3s budget.
 * A bar that runs past the axis is cut at its end and its 90th percentile written there.
 * From slides/data/bhh.json.
 */
const BUDGET_MS = jev.run.latency.budgetMs;
// Long enough for every median; a slower 90th percentile is cut at the edge.
const AXIS_MS = Math.max(4000, Math.ceil(Math.max(...MODELS.map((m) => m.run.latency.p50)) / 2000) * 2000 + 2000);
const TICKS = Array.from({ length: AXIS_MS / 1000 + 1 }, (_, i) => i * 1000).filter((ms) => AXIS_MS <= 6000 || ms % 2000 === 0);
const at = (ms: number) => `${(100 * Math.min(ms, AXIS_MS)) / AXIS_MS}%`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
// Jev at full strength; the other four as lighter tints of their own colours, so each still
// matches its curve on the ROC chart while Jev stands out.
const ink = (m: Model) => (m === jev ? m.color : `color-mix(in srgb, ${m.color} 55%, white)`);
const fastest = [...others].sort((a, b) => a.run.latency.p50 - b.run.latency.p50)[0]!;
// "gemini-3.8-flash takes longer on 41% of messages and deepseek-v4.1-flash on 94%."
const slow = MODELS.filter((m) => m.run.latency.overBudget >= 0.1);
const overBudget = slow.length
  ? `${slow.map((m, i) => `${m.run.name}${i === 0 ? " takes longer" : ""} on ${Math.round(100 * m.run.latency.overBudget)}%${i === 0 ? " of messages" : ""}`).join(slow.length > 2 ? ", " : " and ")}.`
  : "";

export function Latency({ at: from }: { at: number }) {
  const step = useStep();
  const t = useTransition();
  const play = step >= from;

  return (
    <figure className={`${styles.figure} ${styles.latencyFigure}`} aria-label={`Time per check: ${MODELS.map((m) => `${m.run.name} median ${seconds(m.run.latency.p50)}, 90% under ${seconds(m.run.latency.p90)}`).join("; ")}.`}>
      <div className={styles.statBand}>
        <Stat
          value={seconds(jev.run.latency.p50)}
          label={`${jev.run.name}'s median check`}
          color={jev.color}
          versus={`Fastest of the other four: ${fastest.run.name}, ${seconds(fastest.run.latency.p50)}, ${(fastest.run.latency.p50 / jev.run.latency.p50).toFixed(1)}× as long.`}
        />
      </div>
      <div className={`${styles.plotSurface} ${styles.latencyPlot} flex gap-4`} aria-hidden="true">
        <div className="shrink-0 space-y-2">
          {MODELS.map((m) => (
            <p key={m.id} className={`flex h-11 flex-col justify-center text-fig leading-tight ${m === jev ? "font-semibold" : ""}`}>
              <span className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: ink(m) }} />
                {m.run.name}
              </span>
              <span className="pl-[18px] font-mono text-fig font-normal text-muted">median {seconds(m.run.latency.p50)}</span>
            </p>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <motion.div
            className="absolute inset-y-0 border-l border-ink/40"
            style={{ left: at(BUDGET_MS) }}
            initial={false}
            animate={{ opacity: play ? 1 : 0 }}
            transition={play ? t(DURATION.fast) : t(0)}
          >
            <span className="absolute -top-5 left-1.5 text-fig whitespace-nowrap text-muted">{BUDGET_MS / 1000}s budget</span>
          </motion.div>
          <div className="space-y-2">
            {MODELS.map((m, i) => {
              const cut = m.run.latency.p90 > AXIS_MS;
              return (
                <div key={m.id} className="relative h-11">
                  <motion.span
                    className={`absolute top-1/2 h-2 -translate-y-1/2 origin-left ${cut ? "rounded-l-full" : "rounded-full"}`}
                    style={{ left: at(m.run.latency.p10), right: `calc(100% - ${at(m.run.latency.p90)})`, background: ink(m), opacity: m === jev ? 0.45 : 0.5 }}
                    initial={false}
                    animate={{ scaleX: play ? 1 : 0 }}
                    transition={play ? t(DURATION.base, i * 0.12) : t(0)}
                  />
                  <motion.span
                    className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-canvas"
                    style={{ left: at(m.run.latency.p50), background: ink(m) }}
                    initial={false}
                    animate={{ opacity: play ? 1 : 0 }}
                    transition={play ? t(DURATION.fast, DURATION.base + i * 0.12) : t(0)}
                  />
                  {cut && (
                    <motion.span
                      className="absolute -top-1.5 right-0 font-mono text-fig text-muted"
                      initial={false}
                      animate={{ opacity: play ? 1 : 0 }}
                      transition={play ? t(DURATION.fast, DURATION.base + i * 0.12) : t(0)}
                    >
                      90% by {seconds(m.run.latency.p90)}
                    </motion.span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="relative mt-1 h-5 border-t border-line font-mono text-fig text-muted">
            {/* On a phone, every other tick, so the labels don't run together. */}
            {TICKS.map((ms, i) => (
              <span key={ms} className={`absolute top-1 ${ms === 0 ? "" : ms === AXIS_MS ? "-translate-x-full" : "-translate-x-1/2"} ${i % 2 ? "max-sm:hidden" : ""}`} style={{ left: at(ms) }}>
                {ms / 1000}s
              </span>
            ))}
          </div>
        </div>
      </div>
      <motion.figcaption
        className="mt-3 text-fig"
        initial={false}
        animate={{ opacity: play ? 1 : 0 }}
        transition={play ? t(DURATION.base, DURATION.slow) : t(0)}
      >
        Seconds per check on the BHH test messages: the dot is the median, the bar the middle 80% of
        checks (10th to 90th percentile).{" "}
        <span className="text-muted">
          FirstRead waits {BUDGET_MS / 1000}s for the user check. {overBudget}
        </span>
      </motion.figcaption>
    </figure>
  );
}
