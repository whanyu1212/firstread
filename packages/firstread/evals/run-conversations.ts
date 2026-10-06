/**
 * Replay the multi-turn conversations (conversations.jsonl) through the user check, one exchange
 * at a time, and score them against their labels. Metric definitions are in evals/README.md.
 *
 *     pnpm eval:conversations                          # dev split, Jev
 *     pnpm eval:conversations --split holdout          # only to confirm a change
 *     pnpm eval:conversations --client luna            # LLM baseline (see llm-client.ts)
 *     pnpm eval:conversations --rpm 25                 # stay under a requests/minute limit
 *     pnpm eval:conversations --retry evals/results/<file>.jsonl   # rerun that run's errors
 *
 * The scripted assistant replies go into the transcript, so the user check sees what it would see
 * live. The conversation's sticky level is what's scored.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Conversation, FirstRead, type RiskLevel, type UserSignals } from "../src";
import { CATEGORIES, type LabelledConversation, loadConversations, scoreConversation } from "./conversations";
import { Usage, evalClient, parseClient } from "./llm-client";
import { Pacer, parseRpm } from "./pacing";

type Row = {
  id: string;
  levels: RiskLevel[];
  signals: UserSignals[];
  ms: number[];
  error?: string;
};

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const SHORT: Record<RiskLevel, string> = { NONE: "·", WATCH: "W", ELEVATED: "E", CRISIS: "C" };

const { values: args } = parseArgs({
  options: {
    split: { type: "string" },
    client: { type: "string" },
    rpm: { type: "string" },
    concurrency: { type: "string", default: "1" },
    retry: { type: "string" },
  },
});

// --retry reruns an earlier run's errors with that run's own split and client, from its file name.
const retryOf = args.retry?.match(/conversations-(\w+?)-(\w+?)-\d{4}-[^/]*\.jsonl$/);
if (args.retry && !retryOf) {
  throw new Error(`--retry needs a file written by eval:conversations, got ${args.retry}`);
}
for (const [flag, given, fromFile] of [
  ["split", args.split, retryOf?.[1]],
  ["client", args.client, retryOf?.[2]],
] as const) {
  if (given && fromFile && given !== fromFile) {
    throw new Error(`--${flag} ${given} doesn't match the ${flag} of the --retry file (${fromFile})`);
  }
}
const split = args.split ?? retryOf?.[1] ?? "dev";
if (split !== "dev" && split !== "holdout" && split !== "all") {
  throw new Error(`--split must be dev, holdout or all, got ${split}`);
}
const client = parseClient(args.client ?? retryOf?.[2]);
const concurrency = Number(args.concurrency);
if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("--concurrency must be a whole number >= 1");
const rpm = parseRpm(args.rpm);
const pacer = new Pacer(rpm);
const usage = new Usage();

try {
  process.loadEnvFile(here("../../../.env"));
} catch {
  // fine if the key is already in the environment
}

const all = loadConversations(here("./conversations.jsonl"));
let convs = all.filter((c) => split === "all" || c.split === split);
const prior: Row[] = args.retry
  ? readFileSync(args.retry, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : [];
if (args.retry) {
  const failed = new Set(prior.filter((r) => r.error).map((r) => r.id));
  convs = convs.filter((c) => failed.has(c.id));
  console.log(`retrying ${convs.length} failed conversations from ${args.retry}`);
}

const guard = new FirstRead({ client: evalClient(client, pacer, usage) });
const exchanges = convs.reduce((n, c) => n + c.exchanges.length, 0);
console.log(
  `${client}: ${convs.length} ${split} conversations, ${exchanges} exchanges` +
    `${rpm ? `, at most ${rpm} req/min` : ""}\n`,
);

async function replay(c: LabelledConversation): Promise<Row> {
  const conv = new Conversation();
  const row: Row = { id: c.id, levels: [], signals: [], ms: [] };
  try {
    for (const x of c.exchanges) {
      await pacer.reserve(); // pacing waits aren't counted as latency
      const started = performance.now();
      const { level, signals } = await guard.checkUser(conv, x.user);
      row.ms.push(performance.now() - started);
      row.levels.push(level);
      row.signals.push(signals);
      conv.add("user", x.user);
      conv.add("assistant", x.assistant);
    }
  } catch (err) {
    row.error = String(err);
  }
  return row;
}

const rows: Row[] = [];
let next = 0;
async function worker() {
  for (let c = convs[next++]; c; c = convs[next++]) {
    const row = await replay(c);
    rows.push(row);
    process.stdout.write(`  ${rows.length}/${convs.length}\r`);
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
console.log();
if (prior.length) {
  const redone = new Map(rows.map((r) => [r.id, r]));
  rows.splice(0, rows.length, ...prior.map((r) => redone.get(r.id) ?? r));
}

// ---- report

const byId = new Map(all.map((c) => [c.id, c]));
const scored = rows
  .filter((r) => !r.error)
  .map((r) => ({ row: r, c: byId.get(r.id)!, s: scoreConversation(byId.get(r.id)!, r.levels) }))
  .sort((a, b) => CATEGORIES.indexOf(a.c.category) - CATEGORIES.indexOf(b.c.category));

console.log("conversation                  levels by exchange   expected            result");
for (const { row, c, s } of scored) {
  const levels = row.levels.map((l) => SHORT[l]).join(" ");
  const expected = c.target ? `${c.target} by #${c.detect_by}` : `<= ${Array.isArray(c.ceiling) ? c.ceiling.at(-1) : c.ceiling}`;
  const result = [
    s.missed ? "MISSED" : s.delay !== null ? (s.delay > 0 ? `late +${s.delay}` : s.delay < 0 ? `early ${s.delay}` : "on time") : "ok",
    s.overCeiling.length ? `over ceiling at #${s.overCeiling.join(",#")}` : "",
    s.flaggedAfterRecovery ? `${s.flaggedAfterRecovery} flagged after recovery` : "",
  ]
    .filter(Boolean)
    .join(", ");
  console.log(`${c.id.padEnd(29)} ${levels.padEnd(20)} ${expected.padEnd(19)} ${result}`);
}
console.log("(· NONE  W WATCH  E ELEVATED  C CRISIS)");

const targeted = scored.filter(({ c }) => c.target);
const missed = targeted.filter(({ s }) => s.missed);
const late = targeted.filter(({ s }) => (s.delay ?? 0) > 0);
const over = scored.filter(({ s }) => s.overCeiling.length);
const overExchanges = scored.reduce((n, { s }) => n + s.overCeiling.length, 0);
const recovery = scored.filter(({ s }) => s.flaggedAfterRecovery !== null);

console.log(`\nmissed:            ${missed.length} of ${targeted.length} conversations that should escalate`);
console.log(`late:              ${late.length} (by ${late.map(({ s }) => `+${s.delay}`).join(", ") || "-"})`);
console.log(`over the ceiling:  ${over.length} of ${scored.length} conversations, ${overExchanges} exchanges`);
if (recovery.length) {
  console.log(
    `after recovery:    ${recovery.reduce((n, { s }) => n + (s.flaggedAfterRecovery ?? 0), 0)} exchanges still flagged ` +
      `across ${recovery.length} conversations (cost of the sticky level, not a Jev error)`,
  );
}

console.log("\ncategory         n  missed  late  over ceiling");
for (const cat of CATEGORIES) {
  const rs = scored.filter(({ c }) => c.category === cat);
  if (!rs.length) continue;
  const count = (f: (x: (typeof rs)[number]) => boolean) => String(rs.filter(f).length).padStart(4);
  console.log(
    `${cat.padEnd(15)} ${String(rs.length).padStart(2)}  ${count(({ s }) => s.missed)}  ${count(({ s }) => (s.delay ?? 0) > 0)}  ${count(({ s }) => s.overCeiling.length > 0)}`,
  );
}

const errors = rows.filter((r) => r.error);
if (errors.length) console.log(`\nerrors: ${errors.length} conversations (${errors.map((r) => r.id).join(", ")}), not scored`);

const ms = rows.flatMap((r) => r.ms).sort((a, b) => a - b);
const pct = (p: number) => Math.round(ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] ?? 0);
if (ms.length) console.log(`\nlatency per call: p50 ${pct(0.5)}  p90 ${pct(0.9)}  p99 ${pct(0.99)}  max ${pct(1)} ms`);
console.log(`cost: ${usage.summary(client)}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(here("./results"), { recursive: true });
const out = `conversations-${split}-${client}-${stamp}.jsonl`;
writeFileSync(here(`./results/${out}`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`\nper-exchange signals written to evals/results/${out}`);
