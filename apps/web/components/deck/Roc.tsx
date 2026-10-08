"use client";

import { motion } from "motion/react";
import bhh from "@/slides/data/bhh.json";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * Slide 3: Jev vs gpt-6-luna as ROC curves on the BHH test split, zoomed to the region that
 * matters (few false alarms, high recall), with recall at a 5% false-alarm rate marked.
 * From slides/data/bhh.json (`pnpm --filter firstread export:deck`).
 */
const SERIES = [
  { id: "jev", color: "var(--color-series-1)" },
  { id: "luna", color: "var(--color-series-2)" },
] as const;
const runs = SERIES.map((s) => ({ ...s, run: bhh.runs.find((r) => r.id === s.id)! }));

const X_MAX = 0.2;
const Y_MIN = 0.6;
const MARK_FAR = 0.05;
const W = 480;
const H = 340;
const PAD = { top: 32, right: 12, bottom: 48, left: 48 };
const x = (v: number) => PAD.left + (v / X_MAX) * (W - PAD.left - PAD.right);
const y = (v: number) => PAD.top + ((1 - v) / (1 - Y_MIN)) * (H - PAD.top - PAD.bottom);
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The curve inside the zoomed window: points past the right edge are cut at it, by interpolation. */
function visible(roc: number[][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < roc.length; i++) {
    const [fx, fy] = roc[i] as [number, number];
    if (fx <= X_MAX) out.push([fx, fy]);
    else {
      const [px, py] = roc[i - 1] as [number, number];
      out.push([X_MAX, py + ((fy - py) * (X_MAX - px)) / (fx - px)]);
      break;
    }
  }
  return out;
}

const recallAt = (roc: number[][], far: number) => Math.max(...roc.filter(([fx]) => fx! <= far).map(([, ry]) => ry!));

export function Roc({ at }: { at: number }) {
  const step = useStep();
  const t = useTransition();
  const play = step >= at;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`ROC curves on the BHH test split. ${runs.map((r) => `${r.run.name}: AUC ${r.run.auc}, recall ${pct(recallAt(r.run.roc, MARK_FAR))} at a ${pct(MARK_FAR)} false-alarm rate`).join(". ")}.`}>
        <defs>
          <clipPath id="roc-plot">
            <rect x={PAD.left} y={PAD.top - 4} width={W - PAD.left - PAD.right + 4} height={H - PAD.top - PAD.bottom + 4} />
          </clipPath>
        </defs>
        {[0.6, 0.8, 1].map((v) => (
          <g key={v}>
            <line x1={x(0)} x2={x(X_MAX)} y1={y(v)} y2={y(v)} className="stroke-line" />
            <text x={PAD.left - 10} y={y(v) + 5} textAnchor="end" className="fill-muted font-mono text-[14px]">
              {pct(v)}
            </text>
          </g>
        ))}
        {[0, 0.05, 0.1, 0.15, 0.2].map((v) => (
          <text key={v} x={x(v)} y={H - PAD.bottom + 22} textAnchor={v === 0 ? "start" : v === X_MAX ? "end" : "middle"} className="fill-muted font-mono text-[14px]">
            {pct(v)}
          </text>
        ))}
        <text x={x(X_MAX / 2)} y={H - 6} textAnchor="middle" className="fill-muted text-[14px]">
          False alarms: no-risk messages flagged
        </text>
        <text x={PAD.left - 44} y={14} className="fill-muted text-[14px]">
          Recall: self-harm risk caught
        </text>

        {/* Recall at the same false-alarm rate. */}
        <motion.line
          x1={x(MARK_FAR)} x2={x(MARK_FAR)} y1={y(1)} y2={y(Y_MIN)}
          className="stroke-muted" strokeDasharray="3 3"
          initial={false} animate={{ opacity: play ? 1 : 0 }}
          transition={play ? t(DURATION.fast, DURATION.slow) : t(0)}
        />

        <g clipPath="url(#roc-plot)">
          {runs.map((r, i) => {
            const pts = visible(r.run.roc);
            const d = pts.map(([fx, fy], j) => `${j ? "L" : "M"}${x(fx).toFixed(1)},${y(fy).toFixed(1)}`).join(" ");
            return (
              <motion.path
                key={r.id}
                d={d}
                fill="none"
                stroke={r.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                initial={false}
                animate={{ pathLength: play ? 1 : 0 }}
                transition={play ? t(DURATION.slow, i * 0.3) : t(0)}
              />
            );
          })}
        </g>

        {runs.map((r, i) => {
          const recall = recallAt(r.run.roc, MARK_FAR);
          return (
            <motion.g key={r.id} initial={false} animate={{ opacity: play ? 1 : 0 }} transition={play ? t(DURATION.base, DURATION.slow + i * 0.2) : t(0)}>
              <circle cx={x(MARK_FAR)} cy={y(recall)} r={6} fill={r.color} stroke="var(--color-canvas)" strokeWidth={2} />
              <text x={x(MARK_FAR) + 12} y={y(recall) + (i === 0 ? -10 : 20)} className="fill-ink text-[15px] font-semibold">
                {r.run.name} {pct(recall)}
              </text>
              {/* Direct label at the right end of each curve, with its AUC. */}
              <text x={x(X_MAX) - 4} y={y(visible(r.run.roc).at(-1)![1]) + (i === 0 ? 22 : -10)} textAnchor="end" className="text-[14px]" style={{ fill: r.color }}>
                {r.run.name}, AUC {r.run.auc.toFixed(3)}
              </text>
            </motion.g>
          );
        })}
      </svg>
      <ul className="mt-1 flex gap-5 text-base" aria-label="Legend">
        {runs.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="h-[3px] w-5 rounded" style={{ background: r.color }} aria-hidden="true" />
            {r.run.name}
          </li>
        ))}
      </ul>
      <motion.figcaption
        className="mt-2 text-lg"
        initial={false}
        animate={{ opacity: play ? 1 : 0 }}
        transition={play ? t(DURATION.base, DURATION.slow + 0.4) : t(0)}
      >
        {pct(runs[1]!.run.saturated)} of Luna's answers are 0 or 1, so there's no threshold in between to tune.{" "}
        <span className="text-muted">
          BHH test split: {bhh.cases.positive} self-harm and {bhh.cases.negative} no-risk messages.
        </span>
      </motion.figcaption>
    </figure>
  );
}
