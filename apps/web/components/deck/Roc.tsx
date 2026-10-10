"use client";

import { motion } from "motion/react";
import bhh from "@/slides/data/bhh.json";
import { DURATION, useTransition } from "./motion";
import { MODELS, jev, others } from "./series";
import { Stat } from "./Stat";
import { useStep } from "./steps";

/**
 * Slide 3: Jev vs four general models as ROC curves on the BHH test split, zoomed to the region
 * that matters (few false alarms, high recall), with recall at a 5% false-alarm rate marked. The
 * table under the chart is its legend and its labels: three of the five colours are below 3:1 on
 * white, so no curve is identified by colour alone. From slides/data/bhh.json.
 */
const X_MAX = 0.2;
const Y_MIN = 0.6;
const MARK_FAR = 0.05;
const W = 480;
const H = 300;
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
const best = [...others].sort((a, b) => b.run.auc - a.run.auc)[0]!;
// Share of answers at 0 or 1, lowest first: the fewer, the more thresholds there are to choose from.
const saturation = others.map((m) => m.run.saturated).sort((a, b) => a - b);
// Jev is drawn last so its curve sits on top where they cross.
const drawOrder = [...others, jev];

export function Roc({ at }: { at: number }) {
  const step = useStep();
  const t = useTransition();
  const play = step >= at;
  const show = (delay: number) => ({
    initial: false as const,
    animate: { opacity: play ? 1 : 0 },
    transition: play ? t(DURATION.base, delay) : t(0),
  });

  return (
    <figure>
      <Stat
        value={jev.run.auc.toFixed(3)}
        label={`${jev.run.name}'s AUC`}
        color={jev.color}
        versus={`Best of the other four: ${best.run.name}, ${best.run.auc.toFixed(3)}.`}
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`ROC curves on the BHH test split. ${MODELS.map((m) => `${m.run.name}: AUC ${m.run.auc}, recall ${pct(recallAt(m.run.roc, MARK_FAR))} at a ${pct(MARK_FAR)} false-alarm rate`).join(". ")}.`}>
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
          {drawOrder.map((m, i) => {
            const pts = visible(m.run.roc);
            const d = pts.map(([fx, fy], j) => `${j ? "L" : "M"}${x(fx).toFixed(1)},${y(fy).toFixed(1)}`).join(" ");
            return (
              <motion.path
                key={m.id}
                d={d}
                fill="none"
                stroke={m.color}
                strokeWidth={m === jev ? 2.5 : 2}
                strokeLinejoin="round"
                initial={false}
                animate={{ pathLength: play ? 1 : 0 }}
                transition={play ? t(DURATION.slow, i * 0.12) : t(0)}
              />
            );
          })}
        </g>

        {drawOrder.map((m) => (
          <motion.circle key={m.id} cx={x(MARK_FAR)} cy={y(recallAt(m.run.roc, MARK_FAR))} r={m === jev ? 6 : 5}
            fill={m.color} stroke="var(--color-canvas)" strokeWidth={2} {...show(DURATION.slow)} />
        ))}
        {/* Only Jev is labelled on the chart; the table below names every curve. Its label sits up
            and to the left, clear of its curve, which runs on to the right. */}
        <motion.text x={x(MARK_FAR) - 12} y={y(recallAt(jev.run.roc, MARK_FAR)) - 10} textAnchor="end"
          className="fill-ink text-[15px] font-semibold" {...show(DURATION.slow + 0.2)}>
          {jev.run.name} {pct(recallAt(jev.run.roc, MARK_FAR))}
        </motion.text>
      </svg>

      <table className="mt-1 w-full text-base" aria-label="Legend">
        <thead className="text-sm text-muted">
          <tr>
            <th scope="col" className="pb-1 text-left font-normal">Model</th>
            <th scope="col" className="pb-1 text-right font-normal">AUC</th>
            <th scope="col" className="pb-1 text-right font-normal">Recall at {pct(MARK_FAR)}</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {MODELS.map((m) => (
            <tr key={m.id} className={m === jev ? "font-semibold" : undefined}>
              <th scope="row" className={`py-px text-left ${m === jev ? "font-semibold" : "font-normal"}`}>
                <span className="flex items-center gap-2">
                  <span className="h-[3px] w-5 rounded" style={{ background: m.color }} aria-hidden="true" />
                  {m.run.name}
                </span>
              </th>
              <td className="py-px text-right">{m.run.auc.toFixed(3)}</td>
              <td className="py-px text-right">{pct(recallAt(m.run.roc, MARK_FAR))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <motion.figcaption className="mt-2 text-base" {...show(DURATION.slow + 0.4)}>
        Jev gives an answer in between far more often: {pct(jev.run.saturated)} of its answers are 0 or 1,
        against {pct(saturation[0]!)}–{pct(saturation.at(-1)!)} for the others.{" "}
        <span className="text-muted">
          Luna is read from its true/false token probabilities; the flash models state a probability, at
          low thinking. BHH test split: {bhh.cases.positive.toLocaleString("en-US")} self-harm and{" "}
          {bhh.cases.negative.toLocaleString("en-US")} no-risk messages, all answered by every model.
        </span>
      </motion.figcaption>
    </figure>
  );
}
