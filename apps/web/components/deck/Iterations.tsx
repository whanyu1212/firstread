"use client";

import { motion } from "motion/react";
import { useState } from "react";
import iterations from "@/slides/data/iterations.json";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";
import styles from "./AppendixFigures.module.css";

/**
 * Act 2, the iteration loop: after each change, how much real risk the BHH test split caught at
 * ELEVATED or above (recall) against how many no-risk messages it flagged (false alarms), one
 * change per build step, joined in order like operating points on an ROC curve. The gain and its
 * cost read off the same picture. From slides/data/iterations.json
 * (`pnpm --filter firstread export:iterations`), which rescores each saved run with its commit's
 * policy.
 */
const steps = iterations.steps;
const first = steps[0]!;
const last = steps.at(-1)!;
const pct = (v: number) => `${v.toFixed(1)}%`;
const points = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

// Zoomed to where the points are, in whole steps of 5 points of recall and 1 of false alarms; the
// recall axis says where it starts.
const Y_MIN = Math.floor((Math.min(...steps.map((s) => s.recall)) - 3) / 5) * 5;
const X_MAX = Math.ceil(Math.max(...steps.map((s) => s.falseAlarms)) + 1);
const W = 520;
const H = 250;
const PLOT = { top: 14, bottom: 196, left: 86, right: 500 };
const x = (v: number) => PLOT.left + (v / X_MAX) * (PLOT.right - PLOT.left);
const y = (v: number) => PLOT.top + ((100 - v) / (100 - Y_MIN)) * (PLOT.bottom - PLOT.top);
const X_TICKS = Array.from({ length: X_MAX + 1 }, (_, i) => i);
const Y_TICKS = Array.from({ length: (100 - Y_MIN) / 5 + 1 }, (_, i) => Y_MIN + i * 5);
// Each number sits beside its point, away from its neighbours: below-right for the first, then
// alternating left and right of points that sit close together.
const LABEL = [
  { dx: 12, dy: 20, anchor: "start" },
  { dx: -14, dy: -10, anchor: "end" },
  { dx: 14, dy: -10, anchor: "start" },
] as const;

export function Iterations({ complete = false }: { complete?: boolean }) {
  const currentStep = useStep();
  const step = complete ? steps.length : currentStep;
  const t = useTransition();
  const [hover, setHover] = useState<number | null>(null);
  const { positive, negative } = last.cases;
  // The headline follows the build: the latest change shown, against where it started.
  const now = steps[Math.max(0, Math.min(step, steps.length) - 1)]!;

  return (
    <figure
      className={`${styles.figure} ${complete ? styles.completeIterations : ""}`}
      aria-label={`SI and self-harm messages caught at ELEVATED or above, against no-risk messages flagged: ${steps.map((s) => `${s.change}, ${pct(s.recall)} caught, ${pct(s.falseAlarms)} flagged`).join("; ")}.`}
    >
      {complete && (
        <div className={`${styles.metricGrid} mb-3 grid gap-3 sm:grid-cols-2`}>
          <div className={styles.metricCard}>
            <p className="text-lg font-semibold">Risk messages caught <span className="font-normal text-muted">(recall)</span></p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-accent">{pct(first.recall)} → {pct(last.recall)}</p>
            <p className="mt-1 text-fig text-muted">{points(last.recall - first.recall)} percentage points · higher is better</p>
          </div>
          <div className={styles.metricCard}>
            <p className="text-lg font-semibold">No-risk messages incorrectly flagged</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-level-crisis">{pct(first.falseAlarms)} → {pct(last.falseAlarms)}</p>
            <p className="mt-1 text-fig text-muted">{points(last.falseAlarms - first.falseAlarms)} percentage points · more false alarms</p>
          </div>
        </div>
      )}
      <div className="grid items-start gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          {!complete && <p className="mb-2 text-xl leading-snug">
            <span className="font-semibold">{pct(now.recall)} of real risk caught</span>
            <span className="text-muted">
              {now === first
                ? `, with ${pct(first.falseAlarms)} of no-risk messages flagged.`
                : `: ${points(now.recall - first.recall)} points, for ${points(now.falseAlarms - first.falseAlarms)} points of false alarms.`}
            </span>
          </p>}
          {complete && <p className="mb-2 text-fig text-muted">Up = more risk caught. Right = more false alarms.</p>}
          <div className={`${styles.plotSurface} ${styles.iterationPlot}`}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
              {Y_TICKS.map((v) => (
                <g key={`y${v}`}>
                  <line x1={PLOT.left} x2={PLOT.right} y1={y(v)} y2={y(v)} className="stroke-line" />
                  <text x={PLOT.left - 10} y={y(v) + 5} textAnchor="end" className="fill-muted font-mono text-[16px]">
                    {v}%
                  </text>
                </g>
              ))}
              {X_TICKS.map((v) => (
                <text
                  key={`x${v}`}
                  x={x(v)}
                  y={PLOT.bottom + 22}
                  textAnchor={v === 0 ? "start" : v === X_MAX ? "end" : "middle"}
                  className="fill-muted font-mono text-[16px]"
                >
                  {v}%
                </text>
              ))}
              <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={PLOT.bottom} className="stroke-ink/20" />
              <text x={(PLOT.left + PLOT.right) / 2} y={H - 4} textAnchor="middle" className="fill-muted text-[16px]">
                No-risk messages flagged (false alarms)
              </text>
              <text
                transform={`translate(14 ${(PLOT.top + PLOT.bottom) / 2}) rotate(-90)`}
                textAnchor="middle"
                className="fill-muted text-[16px]"
              >
                Risk messages caught, from {Y_MIN}%
              </text>

              {steps.slice(1).map((s, i) => {
                const prev = steps[i]!;
                const shown = step >= i + 2;
                return (
                  <motion.line
                    key={`seg${s.commit}`}
                    x1={x(prev.falseAlarms)}
                    y1={y(prev.recall)}
                    x2={x(s.falseAlarms)}
                    y2={y(s.recall)}
                    stroke="var(--color-series-1)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    initial={false}
                    animate={{
                      pathLength: shown ? 1 : 0,
                      opacity: shown ? 1 : 0,
                    }}
                    transition={shown ? t(DURATION.base) : t(0)}
                  />
                );
              })}
              {steps.map((s, i) => {
                const shown = step >= i + 1;
                const l = LABEL[i % LABEL.length]!;
                return (
                  <motion.g
                    key={s.commit}
                    initial={false}
                    animate={{ opacity: shown ? 1 : 0 }}
                    transition={shown ? t(DURATION.fast, i === 0 ? 0 : DURATION.base) : t(0)}
                  >
                    <circle
                      cx={x(s.falseAlarms)}
                      cy={y(s.recall)}
                      r={hover === i ? 8 : 6.5}
                      fill="var(--color-series-1)"
                      stroke="var(--color-canvas)"
                      strokeWidth={2}
                    />
                    <text
                      x={x(s.falseAlarms) + l.dx}
                      y={y(s.recall) + l.dy}
                      textAnchor={l.anchor}
                      className="fill-ink text-[17px] font-semibold"
                    >
                      {i + 1}
                    </text>
                  </motion.g>
                );
              })}
            </svg>
          </div>
        </div>

        <div>
          {/* The changes, numbered as on the chart: each one's miss, and where it left recall and false alarms. */}
          <ol className="space-y-4 lg:mt-1">
            {steps.map((s, i) => {
              const shown = step >= i + 1;
              const prev = steps[i - 1];
              return (
                <motion.li
                  key={s.commit}
                  className={`${styles.iterationItem} ${complete ? styles.iterationItemCompact : ""} grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 rounded-lg ${hover === i ? "bg-raised" : ""}`}
                  initial={false}
                  animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  transition={shown ? t(DURATION.base) : t(0)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className="text-lg font-semibold text-series-1">{i + 1}</span>
                  <div>
                    <p className="leading-snug">
                      <span className="block text-lg font-semibold">{i === 0 ? "Starting policy" : s.change}</span>
                    </p>
                    <p className="text-fig leading-snug text-muted">
                      {i > 0 && <span className="font-medium text-ink">Miss addressed: </span>}{s.miss}{" "}
                      {!complete && <span className="font-mono whitespace-nowrap">
                        {s.commit} · {day(s.date)}
                      </span>}
                    </p>
                    <p className="mt-1 text-fig tabular-nums">
                      <span className="font-semibold">{pct(s.recall)} caught</span>
                      <span className="text-muted"> · {pct(s.falseAlarms)} false alarms{!complete && prev && ` (${points(s.falseAlarms - prev.falseAlarms)})`}</span>
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
          {!complete && <motion.figcaption
            className="mt-4 text-fig text-muted"
            initial={false}
            animate={{ opacity: step >= 1 ? 1 : 0 }}
            transition={step >= 1 ? t(DURATION.base, 0.3) : t(0)}
          >
            BHH test split ({positive.toLocaleString("en")} at risk, {negative.toLocaleString("en")} not), at ELEVATED or above. Each run
            rescored with the policy at its commit.
          </motion.figcaption>}
        </div>
      </div>
    </figure>
  );
}
