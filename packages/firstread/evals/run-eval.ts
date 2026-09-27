/**
 * Run the user-side check over evals/cases.jsonl and report how it did.
 *
 *     pnpm eval
 *     pnpm eval --rpm 25        # stay under a requests/minute limit
 *     pnpm eval --client luna   # LLM baseline instead of Jev (see llm-client.ts)
 *
 * Each case is replayed turn by turn, so the sticky risk level is exercised.
 * Headline numbers:
 *   - high-risk recall: of cases expected ELEVATED or CRISIS, how many reached at least ELEVATED
 *   - crisis recall: of cases expected CRISIS, how many reached CRISIS (a human is alerted)
 *   - false-alarm rate: of cases expected NONE, how many were flagged at all
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Conversation, FirstRead, type RiskLevel, type UserSignals, atLeast } from "../src";
import { Usage, evalClient, parseClient } from "./llm-client";
import { Pacer, parseRpm } from "./pacing";

type Case = { id: string; expected: RiskLevel; user_turns: string[] };
type Row = { id: string; expected: RiskLevel; got: RiskLevel | null; signals: UserSignals | null; error?: string };

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const PLACEHOLDER_REPLY = "(assistant reply)";

try {
  process.loadEnvFile(here("../../../.env"));
} catch {
  // fine if the key is already in the environment
}

const { values: args } = parseArgs({ options: { rpm: { type: "string" }, client: { type: "string" } } });
const pacer = new Pacer(parseRpm(args.rpm));
const client = parseClient(args.client);
const usage = new Usage();

const guard = new FirstRead({ client: evalClient(client, pacer, usage) });
console.log(`${client}\n`);
const cases: Case[] = readFileSync(here("./cases.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const rows: Row[] = [];
for (const c of cases) {
  const conv = new Conversation();
  let signals: UserSignals | null = null;
  try {
    for (const msg of c.user_turns) {
      ({ signals } = await guard.checkUser(conv, msg));
      conv.add("user", msg);
      conv.add("assistant", PLACEHOLDER_REPLY);
    }
  } catch (err) {
    // A call that still fails after the SDK's retries: record it and move on.
    rows.push({ id: c.id, expected: c.expected, got: null, signals: null, error: String(err) });
    console.log(`?? ${c.id.padEnd(28)} expected=${c.expected.padEnd(9)} error: ${String(err).slice(0, 80)}`);
    continue;
  }
  rows.push({ id: c.id, expected: c.expected, got: conv.level, signals });
  const mark = conv.level === c.expected ? "ok " : "!! ";
  console.log(`${mark}${c.id.padEnd(28)} expected=${c.expected.padEnd(9)} got=${conv.level}`);
}

const answered = rows.filter((r): r is Row & { got: RiskLevel } => r.got !== null);
const high = answered.filter((r) => atLeast(r.expected, "ELEVATED"));
const crisis = answered.filter((r) => r.expected === "CRISIS");
const benign = answered.filter((r) => r.expected === "NONE");
const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(d, 1))}%`;
console.log(
  `\nhigh-risk recall: ${pct(high.filter((r) => atLeast(r.got, "ELEVATED")).length, high.length)} (${high.length} cases)`,
);
console.log(
  `crisis recall: ${pct(crisis.filter((r) => r.got === "CRISIS").length, crisis.length)} (${crisis.length} cases)`,
);
console.log(
  `false-alarm rate: ${pct(benign.filter((r) => r.got !== "NONE").length, benign.length)} (${benign.length} cases)`,
);

if (answered.length < rows.length) console.log(`errors: ${rows.length - answered.length} (not counted above)`);
console.log(`cost: ${usage.summary(client)}`);

const stamp = `${client}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
mkdirSync(here("./results"), { recursive: true });
const out = here(`./results/${stamp}.jsonl`);
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`per-case signals written to evals/results/${stamp}.jsonl`);
