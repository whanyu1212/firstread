/**
 * Export the BHH comparison as chart data for the deck (HY-159), so its charts show measured
 * numbers. Same runs and definitions as `pnpm compare:bhh --split test`.
 *
 *     pnpm export:deck
 *
 * Writes apps/web/slides/data/bhh.json. Commit it with the results it was built from.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { UserSignals } from "../src";
import { NEGATIVE, POSITIVE, auc, percentile, score } from "./bhh-metrics";
import type { BhhLabel } from "./fetch-bhh";

type Row = { id: string; label: BhhLabel; ms: number; signals: UserSignals | null };

const SPLIT = "test";
const MODELS: Record<string, string> = { jev: "Jev", luna: "gpt-6-luna" };
/** Points kept per ROC curve: enough for a smooth line, small enough to ship. */
const ROC_POINTS = 120;
const CALIBRATION_BINS = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0001];
const LATENCY_BIN_MS = 100;
const LATENCY_MAX_MS = 2500;

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

function latest(): { client: string; file: string }[] {
  const out = new Map<string, string>();
  for (const f of readdirSync(here("./results")).sort()) {
    const client = f.match(new RegExp(`^bhh-${SPLIT}-(\\w+?)-\\d{4}-`))?.[1];
    if (client && client in MODELS) out.set(client, f);
  }
  return [...out].map(([client, file]) => ({ client, file }));
}

const runs = latest().map(({ client, file }) => {
  const rows = new Map<string, Row>();
  for (const line of readFileSync(here(`./results/${file}`), "utf8").split("\n").filter(Boolean)) {
    const row = JSON.parse(line) as Row;
    rows.set(row.id, row);
  }
  return { client, file, rows };
});
// The deck's charts read every model, so never write a file with one missing.
const missing = Object.keys(MODELS).filter((client) => !runs.some((r) => r.client === client));
if (missing.length) {
  throw new Error(`no bhh-${SPLIT} results for ${missing.join(", ")}; run them before \`pnpm export:deck\``);
}

// Paired: only cases every run answered, as in compare-bhh.ts.
const first = runs[0]!;
const shared = [...first.rows.keys()].filter((id) => runs.every((r) => r.rows.get(id)?.signals));
const labelled = shared.filter((id) => {
  const label = first.rows.get(id)!.label;
  return POSITIVE.includes(label) || label === NEGATIVE;
});
const isPos = (id: string) => POSITIVE.includes(first.rows.get(id)!.label);
const round = (x: number, d = 4) => Number(x.toFixed(d));

/** ROC as [false-alarm rate, recall] from the strictest threshold to the loosest. */
function roc(pos: number[], neg: number[]): [number, number][] {
  const thresholds = [...new Set([...pos, ...neg])].sort((a, b) => b - a);
  const points: [number, number][] = [[0, 0]];
  for (const t of thresholds) {
    points.push([neg.filter((n) => n >= t).length / neg.length, pos.filter((p) => p >= t).length / pos.length]);
  }
  points.push([1, 1]);
  if (points.length <= ROC_POINTS) return points.map(([x, y]) => [round(x), round(y)]);
  const step = (points.length - 1) / (ROC_POINTS - 1);
  return Array.from({ length: ROC_POINTS }, (_, i) => points[Math.round(i * step)]!).map(([x, y]) => [round(x), round(y)]);
}

const out = {
  source: `BHH ${SPLIT} split; ${runs.map((r) => r.file).join(", ")}`,
  cases: { positive: labelled.filter(isPos).length, negative: labelled.filter((id) => !isPos(id)).length },
  runs: runs.map((run) => {
    const s = (id: string) => score(run.rows.get(id)!.signals!);
    const pos = labelled.filter(isPos).map(s);
    const neg = labelled.filter((id) => !isPos(id)).map(s);
    const ms = shared.map((id) => run.rows.get(id)!.ms);
    const answers = shared.flatMap((id) => Object.values(run.rows.get(id)!.signals!));
    return {
      id: run.client,
      name: MODELS[run.client],
      auc: round(auc(pos, neg), 3),
      roc: roc(pos, neg),
      /** Share of all answers at <=0.01 or >=0.99: high means few usable thresholds. */
      saturated: round(answers.filter((p) => p <= 0.01 || p >= 0.99).length / answers.length, 3),
      calibration: CALIBRATION_BINS.slice(0, -1).map((lo, i) => {
        const ids = labelled.filter((id) => s(id) >= lo && s(id) < CALIBRATION_BINS[i + 1]!);
        return {
          lo,
          hi: Math.min(1, CALIBRATION_BINS[i + 1]!),
          n: ids.length,
          meanScore: ids.length ? round(ids.reduce((a, id) => a + s(id), 0) / ids.length, 3) : null,
          positiveShare: ids.length ? round(ids.filter(isPos).length / ids.length, 3) : null,
        };
      }),
      latency: {
        p50: Math.round(percentile(ms, 0.5)),
        p90: Math.round(percentile(ms, 0.9)),
        p99: Math.round(percentile(ms, 0.99)),
        binMs: LATENCY_BIN_MS,
        /** Calls per bin from 0; the last bin holds everything slower. */
        histogram: Array.from({ length: LATENCY_MAX_MS / LATENCY_BIN_MS }, (_, i) =>
          ms.filter((m) => {
            const bin = Math.min(Math.floor(m / LATENCY_BIN_MS), LATENCY_MAX_MS / LATENCY_BIN_MS - 1);
            return bin === i;
          }).length,
        ),
      },
    };
  }),
};

const target = here("../../../apps/web/slides/data/bhh.json");
writeFileSync(target, `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${target}`);
for (const r of out.runs) console.log(`  ${r.name}: AUC ${r.auc}, p50 ${r.latency.p50}ms, ${r.roc.length} ROC points`);
