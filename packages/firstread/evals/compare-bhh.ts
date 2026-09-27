/**
 * Compare eval:bhh runs from different clients (Jev vs the LLM baselines in llm-client.ts).
 *
 *     pnpm compare:bhh                         # latest validation run per client
 *     pnpm compare:bhh --split test
 *     pnpm compare:bhh results/a.jsonl results/b.jsonl
 *
 * policy.ts's thresholds were tuned on Jev, so "as deployed" numbers favour Jev. The fair
 * comparison collapses each case to one score, the highest self-harm probability, and sweeps a
 * threshold per client: AUC, and recall at a matched false-alarm rate. Positives are
 * suicidal_ideation + self_harm, negatives are no_crisis. The intervals are 95% paired
 * bootstraps over the cases every run has in common, so Jev and each baseline are resampled
 * together.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { type RiskLevel, type UserSignals, atLeast } from "../src";
import type { BhhLabel } from "./fetch-bhh";

type Row = { id: string; label: BhhLabel; ms: number; got: RiskLevel | null; signals: UserSignals | null };
type Run = { name: string; file: string; rows: Map<string, Row> };

const SELF_HARM_KEYS = [
  "ideation",
  "self_harm",
  "method_seeking",
  "plan",
  "means",
  "intent",
  "preparation",
  "imminent",
] as const satisfies readonly (keyof UserSignals)[];
const POSITIVE: BhhLabel[] = ["suicidal_ideation", "self_harm"];
const NEGATIVE: BhhLabel = "no_crisis";
const FAR_TARGETS = [0.03, 0.05, 0.1];
const BOOTSTRAPS = 2000;

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const { values: args, positionals } = parseArgs({
  options: { split: { type: "string", default: "validation" } },
  allowPositionals: true,
});

function load(file: string): Run {
  const name = file.match(/bhh-\w+?-(\w+?)-\d{4}-/)?.[1] ?? file;
  const rows = new Map<string, Row>();
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const row = JSON.parse(line) as Row;
    rows.set(row.id, row);
  }
  return { name, file, rows };
}

function latestRuns(split: string): string[] {
  const dir = here("./results");
  const latest = new Map<string, string>();
  for (const f of readdirSync(dir).sort()) {
    const client = f.match(new RegExp(`^bhh-${split}-(\\w+?)-\\d{4}-`))?.[1];
    if (client) latest.set(client, `${dir}/${f}`);
  }
  // Jev first: it's the reference the baselines are compared against.
  return [...latest.entries()].sort(([a], [b]) => (a === "jev" ? -1 : b === "jev" ? 1 : a.localeCompare(b))).map(([, f]) => f);
}

const score = (s: UserSignals) => Math.max(...SELF_HARM_KEYS.map((k) => s[k]));

/** AUC as P(score of a positive > score of a negative), ties counting half. */
function auc(pos: number[], neg: number[]): number {
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

/** Recall at the lowest threshold whose false-alarm rate is at most `far`, and that FAR. */
function recallAtFar(pos: number[], neg: number[], far: number): { recall: number; far: number } {
  const thresholds = [...new Set([...pos, ...neg, Number.POSITIVE_INFINITY])].sort((a, b) => a - b);
  for (const t of thresholds) {
    const f = neg.filter((n) => n >= t).length / neg.length;
    if (f <= far) return { recall: pos.filter((p) => p >= t).length / pos.length, far: f };
  }
  return { recall: 0, far: 0 };
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
};
const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const ci = (xs: number[], f: (x: number) => string) => `[${f(percentile(xs, 0.025))}, ${f(percentile(xs, 0.975))}]`;

// Deterministic resampling so reruns print the same intervals.
let seed = 42;
const random = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

const files = positionals.length ? positionals : latestRuns(args.split!);
if (files.length === 0) throw new Error(`no bhh-${args.split} results found; run \`pnpm eval:bhh\` first`);
const runs = files.map(load);

// Only cases every run answered, so the comparison is paired.
const shared = [...runs[0]!.rows.keys()].filter((id) => runs.every((r) => r.rows.get(id)?.signals));
const labelled = shared.filter((id) => {
  const label = runs[0]!.rows.get(id)!.label;
  return POSITIVE.includes(label) || label === NEGATIVE;
});
const isPos = (id: string) => POSITIVE.includes(runs[0]!.rows.get(id)!.label);
const nPos = labelled.filter(isPos).length;

console.log(`${shared.length} cases answered by every run; ${nPos} SI/self-harm vs ${labelled.length - nPos} no_crisis\n`);
for (const r of runs) console.log(`  ${r.name.padEnd(5)} ${r.file.split("/").at(-1)}`);

const split = (run: Run, ids: string[]) => {
  const pos: number[] = [];
  const neg: number[] = [];
  for (const id of ids) (isPos(id) ? pos : neg).push(score(run.rows.get(id)!.signals!));
  return { pos, neg };
};

// Bootstrap resamples, shared by every run so the differences are paired.
const resamples = Array.from({ length: BOOTSTRAPS }, () =>
  labelled.map(() => labelled[Math.floor(random() * labelled.length)]!),
);

console.log("\nThreshold swept per client (max self-harm probability):");
console.log("client  AUC                    recall @ FAR<=3%   @ 5%        @ 10%       AUC vs jev");
const aucsByRun = new Map<string, number[]>();
let jevAuc = 0;
for (const run of runs) {
  const { pos, neg } = split(run, labelled);
  const aucs = resamples.map((ids) => {
    const s = split(run, ids);
    return auc(s.pos, s.neg);
  });
  aucsByRun.set(run.name, aucs);
  const recalls = FAR_TARGETS.map((f) => {
    const { recall, far } = recallAtFar(pos, neg, f);
    return `${pct(recall).padStart(4)} (${pct(far)})`.padEnd(12);
  });
  const value = auc(pos, neg);
  if (run === runs[0]) jevAuc = value;
  const ref = aucsByRun.get(runs[0]!.name)!;
  const diff =
    run === runs[0] ? "" : `${(value - jevAuc).toFixed(3)} ${ci(aucs.map((a, i) => a - ref[i]!), (x) => x.toFixed(3))}`;
  console.log(
    `${run.name.padEnd(7)} ${value.toFixed(3)} ${ci(aucs, (x) => x.toFixed(3)).padEnd(15)}  ${recalls.join("")}${diff}`,
  );
}
console.log("(recall is at the lowest threshold whose actual false-alarm rate, in brackets, is under the target)");

console.log("\nAs deployed (policy.ts thresholds, tuned on Jev):");
console.log("client  SI/SH >=ELEVATED  SI/SH >=WATCH  no_crisis >=WATCH  no_crisis >=ELEVATED  violent >=WATCH  out-of-scope >=WATCH");
for (const run of runs) {
  const rows = shared.map((id) => run.rows.get(id)!);
  const rate = (labels: BhhLabel[], min: RiskLevel) => {
    const rs = rows.filter((r) => labels.includes(r.label));
    return rs.length ? pct(rs.filter((r) => atLeast(r.got!, min)).length / rs.length) : "-";
  };
  const outOfScope: BhhLabel[] = ["anxiety_crisis", "substance_abuse_or_withdrawal", "risk_taking_behaviors"];
  console.log(
    `${run.name.padEnd(7)} ${rate(POSITIVE, "ELEVATED").padStart(16)}  ${rate(POSITIVE, "WATCH").padStart(13)}  ` +
      `${rate([NEGATIVE], "WATCH").padStart(17)}  ${rate([NEGATIVE], "ELEVATED").padStart(20)}  ` +
      `${rate(["violent_thoughts"], "WATCH").padStart(15)}  ${rate(outOfScope, "WATCH").padStart(20)}`,
  );
}

console.log("\nCalibration of the max self-harm probability (share of SI/self-harm cases per bin):");
const BINS = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0001];
console.log(`client  ${BINS.slice(0, -1).map((b, i) => `${b}-${Math.min(1, BINS[i + 1]!)}`.padEnd(12)).join("")}Brier   saturated`);
for (const run of runs) {
  const cells = BINS.slice(0, -1).map((lo, i) => {
    const ids = labelled.filter((id) => {
      const s = score(run.rows.get(id)!.signals!);
      return s >= lo && s < BINS[i + 1]!;
    });
    return (ids.length ? `${pct(ids.filter(isPos).length / ids.length)} n=${ids.length}` : "-").padEnd(12);
  });
  const brier =
    labelled.reduce((sum, id) => sum + (score(run.rows.get(id)!.signals!) - (isPos(id) ? 1 : 0)) ** 2, 0) /
    labelled.length;
  // Share of all answers (every question, every case) that are effectively 0 or 1.
  const answers = shared.flatMap((id) => Object.values(run.rows.get(id)!.signals!));
  const saturated = answers.filter((p) => p <= 0.01 || p >= 0.99).length / answers.length;
  console.log(`${run.name.padEnd(7)} ${cells.join("")}${brier.toFixed(3)}   ${pct(saturated)}`);
}
console.log("(saturated: share of all question answers at <=0.01 or >=0.99; high means few usable thresholds)");

console.log("\nLatency per call (ms):");
for (const run of runs) {
  const ms = shared.map((id) => run.rows.get(id)!.ms);
  const f = (p: number) => String(Math.round(percentile(ms, p))).padStart(6);
  console.log(`${run.name.padEnd(7)} p50 ${f(0.5)}  p90 ${f(0.9)}  p99 ${f(0.99)}  max ${f(1)}`);
}

console.log("\nSI/self-harm cases below ELEVATED as deployed:");
for (const run of runs) {
  const missed = labelled.filter((id) => isPos(id) && !atLeast(run.rows.get(id)!.got!, "ELEVATED"));
  console.log(`${run.name.padEnd(7)} ${missed.length ? missed.join(" ") : "none"}`);
}
