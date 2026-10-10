"use client";

import { motion } from "motion/react";
import { useState } from "react";
import bhh from "@/slides/data/bhh.json";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * Slide 3, "consistent": Jev's highest self-harm probability per message against how often those
 * messages really were self-harm risk, on the BHH test split, with how many messages fell in each
 * bin underneath. It shows what the data supports: real risk rises at every step, so one cutoff
 * means the same on every message; it doesn't claim Jev's numbers equal the real share, because in
 * the middle they run low. From slides/data/bhh.json.
 */
const jev = bhh.runs.find((r) => r.id === "jev")!;
const bins = jev.calibration.filter((b) => b.n > 0 && b.meanScore !== null && b.positiveShare !== null);
const rising = bins.every((b, i) => i === 0 || b.positiveShare! > bins[i - 1]!.positiveShare!);
// Where Jev's number is furthest below the real share: the caption's example.
const low = bins.reduce((a, b) => (b.positiveShare! - b.meanScore! > a.positiveShare! - a.meanScore! ? b : a));
const maxN = Math.max(...bins.map((b) => b.n));

const W = 500;
const H = 336;
const PLOT = { top: 12, bottom: 212, left: 92, right: 488 };
// Below the axis title: a strip of bars, one per bin, with the count under each.
const COUNTS = { top: 268, bottom: 304 };
const x = (v: number) => PLOT.left + v * (PLOT.right - PLOT.left);
const y = (v: number) => PLOT.top + (1 - v) * (PLOT.bottom - PLOT.top);
const path = bins.map((b, i) => `${i ? "L" : "M"}${x(b.meanScore!).toFixed(1)},${y(b.positiveShare!).toFixed(1)}`).join(" ");
const pct = (v: number) => `${Math.round(v * 100)}%`;
// The perfect-calibration line's angle on screen, for its label.
// Rounded, so the server's and the browser's floating point agree when the page hydrates.
const DIAGONAL = ((Math.atan2(y(1) - y(0), x(1) - x(0)) * 180) / Math.PI).toFixed(2);

export function Calibration({ at }: { at: number }) {
  const step = useStep();
  const t = useTransition();
  const [hover, setHover] = useState<number | null>(null);
  const play = step >= at;
  const focus = hover === null ? null : bins[hover]!;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Jev's self-harm probability against the share of BHH test messages that really were self-harm risk, with the number of messages per probability bin">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} className="stroke-line" />
            <text x={PLOT.left - 10} y={y(v) + 5} textAnchor="end" className="fill-muted font-mono text-[16px]">
              {pct(v)}
            </text>
            <text x={x(v)} y={PLOT.bottom + 24} textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"} className="fill-muted font-mono text-[16px]">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <text transform={`translate(16 ${(PLOT.top + PLOT.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="fill-muted text-[16px]">
          Really self-harm risk
        </text>
        <text x={(PLOT.left + PLOT.right) / 2} y={PLOT.bottom + 48} textAnchor="middle" className="fill-muted text-[16px]">
          Jev's probability of self-harm risk
        </text>

        {/* Perfect calibration: the probability equals the real share. */}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="stroke-muted" strokeDasharray="4 4" />
        <text transform={`translate(${x(0.72)} ${y(0.6)}) rotate(${DIAGONAL})`} textAnchor="middle" className="fill-muted text-[16px]">
          Perfect calibration
        </text>

        <motion.path
          d={path}
          fill="none"
          stroke="var(--color-series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: play ? 1 : 0 }}
          transition={play ? t(DURATION.slow) : t(0)}
        />

        {/* How many messages each bin holds: most sit near 0 or 1, so the middle points rest on few. */}
        <text x={PLOT.left - 10} y={H - 6} textAnchor="end" className="fill-muted text-[16px]">
          messages
        </text>
        {bins.map((b, i) => {
          const h = Math.max(2, ((COUNTS.bottom - COUNTS.top) * b.n) / maxN);
          return (
            <g key={`n-${b.lo}`}>
              <motion.rect
                x={x(b.lo) + 1}
                width={x(b.hi) - x(b.lo) - 2}
                y={COUNTS.bottom - h}
                height={h}
                rx={2}
                className={hover === i ? "fill-series-1" : "fill-ink/15"}
                initial={false}
                animate={{ opacity: play ? 1 : 0 }}
                transition={play ? t(DURATION.base, (DURATION.slow * i) / bins.length) : t(0)}
              />
              <motion.text
                x={(x(b.lo) + x(b.hi)) / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted font-mono text-[16px]"
                initial={false}
                animate={{ opacity: play ? 1 : 0 }}
                transition={play ? t(DURATION.base, (DURATION.slow * i) / bins.length) : t(0)}
              >
                {b.n.toLocaleString("en")}
              </motion.text>
            </g>
          );
        })}

        {bins.map((b, i) => (
          <g key={b.lo}>
            <motion.circle
              cx={x(b.meanScore!)}
              cy={y(b.positiveShare!)}
              r={6}
              fill="var(--color-series-1)"
              stroke="var(--color-canvas)"
              strokeWidth={2}
              initial={false}
              animate={{ scale: play ? 1 : 0 }}
              transition={play ? t(DURATION.fast, (DURATION.slow * i) / bins.length) : t(0)}
            />
            <rect
              x={x(b.meanScore!) - 16}
              y={y(b.positiveShare!) - 16}
              width={32}
              height={32}
              fill="transparent"
              tabIndex={play ? 0 : -1}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`Probability ${b.lo} to ${b.hi}: ${pct(b.positiveShare!)} really self-harm risk, ${b.n} messages`}
            />
          </g>
        ))}
      </svg>
      <motion.figcaption
        className="mt-3 min-h-[5.25rem] text-lg leading-snug"
        initial={false}
        animate={{ opacity: play ? 1 : 0 }}
        transition={play ? t(DURATION.base, DURATION.slow) : t(0)}
      >
        {focus ? (
          <>
            Probability {focus.lo}–{focus.hi}: {pct(focus.positiveShare!)} really were self-harm risk{" "}
            <span className="text-muted">({focus.n.toLocaleString("en")} messages, average probability {focus.meanScore!.toFixed(2)})</span>
          </>
        ) : (
          <>
            {rising ? "Real risk rises at every step, so a cutoff means the same on every message." : "Real risk mostly rises with Jev's probability."}{" "}
            <span className="text-muted">
              The numbers run low in the middle: messages Jev put at {low.meanScore!.toFixed(2)} were really at risk{" "}
              {pct(low.positiveShare!)} of the time, so cutoffs are set from measured recall, not read as odds.{" "}
              {(bhh.cases.positive + bhh.cases.negative).toLocaleString("en")} BHH test messages.
            </span>
          </>
        )}
      </motion.figcaption>
    </figure>
  );
}
