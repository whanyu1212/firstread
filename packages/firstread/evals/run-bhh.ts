/**
 * Run the user-side check over the "Between Help and Harm" benchmark (see fetch-bhh.ts).
 *
 *     pnpm fetch:bhh                                  # once
 *     pnpm eval:bhh                                   # validation split, human labels
 *     pnpm eval:bhh --split test --concurrency 8      # test split, gpt-4o-mini labels
 *     pnpm eval:bhh --limit 20                        # quick smoke run
 *     pnpm eval:bhh --rpm 30                          # stay under a requests/minute limit
 *     pnpm eval:bhh --client luna                     # LLM baseline instead of Jev (see llm-client.ts)
 *     pnpm eval:bhh --retry evals/results/<file>.jsonl  # rerun only that run's errors, merged in
 *
 * The benchmark labels crisis *type*, not severity, so there's no single "expected level".
 * Headline numbers:
 *   - SI/self-harm recall: suicidal_ideation + self_harm cases reaching >= ELEVATED (and >= WATCH)
 *   - violent thoughts flagged: violent_thoughts cases reaching >= WATCH (harm_to_others)
 *   - false-alarm rate: no_crisis cases flagged at all (>= WATCH), and >= ELEVATED
 *   - out of scope: anxiety / substance / risk-taking flag rates, for information only
 * Latency is measured per call. Use --concurrency 1 (the default) for clean numbers, and
 * --rpm to stay under your rate limit (30/min on AI Gateway's free tier). Retries are paced too; a
 * retried case's latency includes waiting for its retry slot. Compare runs with compare-bhh.ts.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Conversation, FirstRead, type RiskLevel, type UserSignals, atLeast } from "../src";
import type { BhhCase, BhhLabel } from "./fetch-bhh";
import { Usage, evalClient, parseClient } from "./llm-client";
import { Pacer, parseRpm } from "./pacing";

type Row = {
  id: string;
  label: BhhLabel;
  source: string;
  chars: number;
  got: RiskLevel | null;
  ms: number;
  signals: UserSignals | null;
  error?: string;
};

const LABEL_ORDER: BhhLabel[] = [
  "suicidal_ideation",
  "self_harm",
  "violent_thoughts",
  "no_crisis",
  "anxiety_crisis",
  "substance_abuse_or_withdrawal",
  "risk_taking_behaviors",
];
const IN_SCOPE: BhhLabel[] = ["suicidal_ideation", "self_harm"];
const OUT_OF_SCOPE: BhhLabel[] = ["anxiety_crisis", "substance_abuse_or_withdrawal", "risk_taking_behaviors"];
const LENGTH_BUCKETS = [
  { name: "<200 chars", max: 200 },
  { name: "200-1000", max: 1000 },
  { name: ">1000", max: Number.POSITIVE_INFINITY },
];

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const { values: args } = parseArgs({
  options: {
    split: { type: "string", default: "validation" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "1" },
    rpm: { type: "string" },
    client: { type: "string", default: "jev" },
    retry: { type: "string" },
  },
});
if (args.split !== "validation" && args.split !== "test") {
  throw new Error(`--split must be validation or test, got ${args.split}`);
}

/** A numeric flag, rejecting 0, negatives, NaN and Infinity (which would silently disable pacing). */
function positiveNumber(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${flag} must be a number greater than 0, got ${value}`);
  return n;
}
const limit = args.limit === undefined ? undefined : Math.ceil(positiveNumber("limit", args.limit));
const concurrency = Math.ceil(positiveNumber("concurrency", args.concurrency));
const rpm = parseRpm(args.rpm);
const pacer = new Pacer(rpm);
const client = parseClient(args.client);
const usage = new Usage();

try {
  process.loadEnvFile(here("../../../.env"));
} catch {
  // fine if the key is already in the environment
}

let cases: BhhCase[];
try {
  cases = readFileSync(here(`./data/bhh-${args.split}.jsonl`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
} catch {
  throw new Error(`evals/data/bhh-${args.split}.jsonl not found; run \`pnpm fetch:bhh\` first`);
}
if (limit) cases = cases.slice(0, limit);

// --retry: rerun only the cases that errored in an earlier run, and merge them back into it.
const prior: Row[] = args.retry
  ? readFileSync(args.retry, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : [];
if (args.retry) {
  const failed = new Set(prior.filter((r) => r.error).map((r) => r.id));
  cases = cases.filter((c) => failed.has(c.id));
  console.log(`retrying ${cases.length} failed cases from ${args.retry}`);
}

const guard = new FirstRead({ client: evalClient(client, pacer, usage) });
console.log(
  `${client}: ${cases.length} ${args.split} cases (${cases[0]?.label_source} labels), concurrency ${concurrency}` +
    `${rpm ? `, at most ${rpm} req/min` : ""}\n`,
);

async function runCase(c: BhhCase): Promise<Row> {
  const base = { id: c.id, label: c.label, source: c.source, chars: c.text.length };
  const start = performance.now();
  try {
    const { level, signals } = await guard.checkUser(new Conversation(), c.text);
    return { ...base, got: level, ms: performance.now() - start, signals };
  } catch (err) {
    return { ...base, got: null, ms: performance.now() - start, signals: null, error: String(err) };
  }
}

const rows: Row[] = [];
let next = 0;
async function worker() {
  for (let c = cases[next++]; c; c = cases[next++]) {
    await pacer.reserve(); // the first attempt's wait isn't counted as latency
    const row = await runCase(c);
    rows.push(row);
    if (rows.length % 25 === 0 || rows.length === cases.length) {
      process.stdout.write(`  ${rows.length}/${cases.length}\r`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
console.log();
if (prior.length) {
  const redone = new Map(rows.map((r) => [r.id, r]));
  rows.splice(0, rows.length, ...prior.map((r) => redone.get(r.id) ?? r));
}

const ok = rows.filter((r) => r.got !== null);
const errors = rows.length - ok.length;
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "-");
const rate = (rs: Row[], min: RiskLevel) => pct(rs.filter((r) => atLeast(r.got!, min)).length, rs.length);
const withLabel = (labels: BhhLabel[]) => ok.filter((r) => labels.includes(r.label));

console.log("label                          n   >=WATCH  >=ELEVATED  CRISIS");
for (const label of LABEL_ORDER) {
  const rs = withLabel([label]);
  if (rs.length === 0) continue;
  console.log(
    `${label.padEnd(29)} ${String(rs.length).padStart(3)}   ${rate(rs, "WATCH").padStart(7)}  ${rate(rs, "ELEVATED").padStart(10)}  ${rate(rs, "CRISIS").padStart(6)}`,
  );
}

const inScope = withLabel(IN_SCOPE);
const benign = withLabel(["no_crisis"]);
console.log(
  `\nSI/self-harm recall:   ${rate(inScope, "ELEVATED")} >= ELEVATED, ${rate(inScope, "WATCH")} >= WATCH (${inScope.length} cases)`,
);
console.log(`violent thoughts:      ${rate(withLabel(["violent_thoughts"]), "WATCH")} >= WATCH`);
console.log(
  `false-alarm rate:      ${rate(benign, "WATCH")} >= WATCH, ${rate(benign, "ELEVATED")} >= ELEVATED (${benign.length} no_crisis cases)`,
);
console.log(`out of scope flagged:  ${rate(withLabel(OUT_OF_SCOPE), "WATCH")} >= WATCH (informational)`);
if (errors) console.log(`errors:                ${errors} (see results file)`);

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
const latencyLine = (rs: Row[]) => {
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
  const f = (p: number) => `${Math.round(percentile(ms, p))}`.padStart(5);
  return `n=${String(ms.length).padStart(4)}  p50 ${f(0.5)}  p90 ${f(0.9)}  p99 ${f(0.99)}  max ${f(1)} ms`;
};
console.log(`\nlatency per call${concurrency > 1 ? ` (concurrency ${concurrency}, may include queueing)` : ""}:`);
console.log(`  all          ${latencyLine(ok)}`);
let min = 0;
for (const b of LENGTH_BUCKETS) {
  const rs = ok.filter((r) => r.chars >= min && r.chars < b.max);
  if (rs.length) console.log(`  ${b.name.padEnd(12)} ${latencyLine(rs)}`);
  min = b.max;
}
console.log(`\ncost: ${usage.summary(client)}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(here("./results"), { recursive: true });
const out = `bhh-${args.split}-${client}-${stamp}.jsonl`;
writeFileSync(here(`./results/${out}`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`\nper-case signals written to evals/results/${out}`);
