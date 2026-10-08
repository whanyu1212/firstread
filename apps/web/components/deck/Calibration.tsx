"use client";

import { motion } from "motion/react";
import { useState } from "react";
import bhh from "@/slides/data/bhh.json";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * Slide 2, "calibrated": Jev's highest self-harm probability per message against how often those
 * messages really were self-harm risk, on the BHH test split. From slides/data/bhh.json.
 */
const jev = bhh.runs.find((r) => r.id === "jev")!;
const bins = jev.calibration.filter((b) => b.n > 0 && b.meanScore !== null && b.positiveShare !== null);

const W = 480;
const H = 250;
const PAD = { top: 12, right: 12, bottom: 44, left: 48 };
const x = (v: number) => PAD.left + v * (W - PAD.left - PAD.right);
const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom);
const path = bins.map((b, i) => `${i ? "L" : "M"}${x(b.meanScore!).toFixed(1)},${y(b.positiveShare!).toFixed(1)}`).join(" ");
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function Calibration({ at }: { at: number }) {
  const step = useStep();
  const t = useTransition();
  const [hover, setHover] = useState<number | null>(null);
  const play = step >= at;
  const focus = hover === null ? null : bins[hover]!;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Calibration of Jev's self-harm probability on the BHH test split">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} className="stroke-line" />
            <text x={PAD.left - 10} y={y(v) + 4} textAnchor="end" className="fill-muted font-mono text-[14px]">
              {pct(v)}
            </text>
            <text x={x(v)} y={H - PAD.bottom + 22} textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"} className="fill-muted font-mono text-[14px]">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={x(0.5)} y={H - 4} textAnchor="middle" className="fill-muted text-[14px]">
          Jev's probability of self-harm risk
        </text>
        {/* Perfect calibration: the probability equals the real share. */}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="stroke-muted" strokeDasharray="4 4" />
        <text x={x(0.5)} y={y(0.36)} className="fill-muted text-[14px]">
          probability = real share
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
        className="mt-1 min-h-[3.5rem] text-lg"
        initial={false}
        animate={{ opacity: play ? 1 : 0 }}
        transition={play ? t(DURATION.base, DURATION.slow) : t(0)}
      >
        {focus ? (
          <>
            Probability {focus.lo}–{focus.hi}: {pct(focus.positiveShare!)} really were self-harm risk{" "}
            <span className="text-muted">({focus.n} messages)</span>
          </>
        ) : (
          <>
            A higher probability means more real risk, at every step.{" "}
            <span className="text-muted">
              Share of BHH test messages that really were self-harm risk ({bhh.cases.positive + bhh.cases.negative} messages).
            </span>
          </>
        )}
      </motion.figcaption>
    </figure>
  );
}
