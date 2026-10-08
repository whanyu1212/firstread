"use client";

import { motion } from "motion/react";
import bhh from "@/slides/data/bhh.json";
import { DURATION, useTransition } from "./motion";
import { useStep } from "./steps";

/**
 * Slide 3: how long one check takes, Jev vs gpt-6-luna, as two histograms on one time axis with
 * each median marked. From slides/data/bhh.json.
 */
const SERIES = [
  { id: "jev", color: "var(--color-series-1)" },
  { id: "luna", color: "var(--color-series-2)" },
] as const;
const runs = SERIES.map((s) => ({ ...s, run: bhh.runs.find((r) => r.id === s.id)! }));
const BINS = runs[0]!.run.latency.histogram.length;
const BIN_MS = runs[0]!.run.latency.binMs;
const AXIS_MS = BINS * BIN_MS;
const peak = Math.max(...runs.flatMap((r) => r.run.latency.histogram));
const at = (ms: number) => `${(100 * ms) / AXIS_MS}%`;

export function Latency({ at: from }: { at: number }) {
  const step = useStep();
  const t = useTransition();
  const play = step >= from;

  return (
    <figure aria-label={`Time per check: ${runs.map((r) => `${r.run.name} median ${(r.run.latency.p50 / 1000).toFixed(2)}s`).join(", ")}.`}>
      <div className="space-y-4">
        {runs.map((r, i) => (
          <div key={r.id}>
            <p className="mb-1 flex items-baseline gap-2 text-base">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} aria-hidden="true" />
              {r.run.name}
              <span className="font-mono text-muted">median {(r.run.latency.p50 / 1000).toFixed(2)}s</span>
            </p>
            <div className="relative flex h-24 items-end gap-px" aria-hidden="true">
              {r.run.latency.histogram.map((n, b) => (
                <motion.span
                  key={b}
                  className="flex-1 origin-bottom rounded-t-[2px]"
                  style={{ height: `${(100 * n) / peak}%`, background: r.color }}
                  initial={false}
                  animate={{ scaleY: play ? 1 : 0 }}
                  transition={play ? t(DURATION.base, i * 0.25 + b * 0.015) : t(0)}
                />
              ))}
              <motion.span
                className="absolute inset-y-0 border-l-2 border-ink"
                style={{ left: at(r.run.latency.p50) }}
                initial={false}
                animate={{ opacity: play ? 1 : 0 }}
                transition={play ? t(DURATION.fast, DURATION.base + i * 0.25) : t(0)}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-1 h-5 border-t border-line font-mono text-sm text-muted" aria-hidden="true">
        {[0, 500, 1000, 1500, 2000, 2500].map((ms) => (
          <span key={ms} className={`absolute top-1 ${ms === 0 ? "" : ms === AXIS_MS ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: at(ms) }}>
            {ms / 1000}s
          </span>
        ))}
      </div>
      <motion.figcaption
        className="mt-3 text-lg"
        initial={false}
        animate={{ opacity: play ? 1 : 0 }}
        transition={play ? t(DURATION.base, DURATION.slow) : t(0)}
      >
        Seconds per check, {runs[0]!.run.latency.histogram.reduce((a, b) => a + b, 0)} BHH test messages.{" "}
        <span className="text-muted">The last bar holds everything slower.</span>
      </motion.figcaption>
    </figure>
  );
}
