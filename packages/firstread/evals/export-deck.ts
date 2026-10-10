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
/** Every model the deck's charts show, in legend order, and how each one's probabilities are read. */
const MODELS: Record<string, { name: string; scoring: string }> = {
  jev: { name: "Jev", scoring: "its own probabilities" },
  luna: { name: "gpt-6-luna", scoring: "true/false token probabilities, thinking off" },
  gemini: { name: "gemini-3.8-flash", scoring: "stated probabilities, low thinking" },
  deepseek: { name: "deepseek-v4.1-flash", scoring: "stated probabilities, low thinking" },
  glm: { name: "glm-5.3-flash", scoring: "stated probabilities, low thinking" },
};
/** Points kept per ROC curve: enough for a smooth line, small enough to ship. */
const ROC_POINTS = 120;
const CALIBRATION_BINS = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0001];
/** The user check's latency budget, as in compare-bhh.ts. */
const BUDGET_MS = 3000;

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

function latest(): { client: string; file: string }[] {
  const out = new Map<string, string>();
  for (const f of readdirSync(here("./results")).sort()) {
    const client = f.match(new RegExp(`^bhh-${SPLIT}-(\\w+?)-\\d{4}-`))?.[1];
    if (client && client in MODELS) out.set(client, f);
  }
  // In MODELS order, so the legend and colours don't depend on file names.
  return Object.keys(MODELS).flatMap((client) => (out.has(client) ? [{ client, file: out.get(client)! }] : []));
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
  /** Cases every model answered: the charts are computed on these only, so they stay paired. */
  shared: shared.length,
  cases: { positive: labelled.filter(isPos).length, negative: labelled.filter((id) => !isPos(id)).length },
  runs: runs.map((run) => {
    const s = (id: string) => score(run.rows.get(id)!.signals!);
    const pos = labelled.filter(isPos).map(s);
    const neg = labelled.filter((id) => !isPos(id)).map(s);
    const ms = shared.map((id) => run.rows.get(id)!.ms);
    const answers = shared.flatMap((id) => Object.values(run.rows.get(id)!.signals!));
    return {
      id: run.client,
      name: MODELS[run.client]!.name,
      scoring: MODELS[run.client]!.scoring,
      errors: [...run.rows.values()].filter((r) => !r.signals).length,
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
        p10: Math.round(percentile(ms, 0.1)),
        p50: Math.round(percentile(ms, 0.5)),
        p90: Math.round(percentile(ms, 0.9)),
        p99: Math.round(percentile(ms, 0.99)),
        budgetMs: BUDGET_MS,
        /** Share of calls slower than the budget. */
        overBudget: round(ms.filter((m) => m > BUDGET_MS).length / ms.length, 3),
      },
    };
  }),
};

const target = here("../../../apps/web/slides/data/bhh.json");
writeFileSync(target, `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${target}`);
for (const r of out.runs) console.log(`  ${r.name}: AUC ${r.auc}, p50 ${r.latency.p50}ms, ${r.roc.length} ROC points`);
