/**
 * Run the user-side check over evals/cases.jsonl and report how it did.
 *
 *     pnpm eval
 *     pnpm eval --rpm 25        # stay under a requests/minute limit
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

type Case = { id: string; expected: RiskLevel; user_turns: string[] };
type Row = { id: string; expected: RiskLevel; got: RiskLevel; signals: UserSignals | null };

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const PLACEHOLDER_REPLY = "(assistant reply)";

try {
  process.loadEnvFile(here("../../../.env"));
} catch {
  // fine if the key is already in the environment
}

const { values: args } = parseArgs({ options: { rpm: { type: "string" } } });
const rpm = args.rpm === undefined ? undefined : Number(args.rpm);
if (rpm !== undefined && !(Number.isFinite(rpm) && rpm > 0)) {
  throw new Error(`--rpm must be a number greater than 0, got ${args.rpm}`);
}
const intervalMs = rpm ? 60_000 / rpm : 0;
let lastCall = Number.NEGATIVE_INFINITY;
/** Space out Jev calls to stay under the rate limit. */
async function pace() {
  const wait = lastCall + intervalMs - performance.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = performance.now();
}

const guard = new FirstRead();
const cases: Case[] = readFileSync(here("./cases.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const rows: Row[] = [];
for (const c of cases) {
  const conv = new Conversation();
  let signals: UserSignals | null = null;
  for (const msg of c.user_turns) {
    await pace();
    ({ signals } = await guard.checkUser(conv, msg));
    conv.add("user", msg);
    conv.add("assistant", PLACEHOLDER_REPLY);
  }
  rows.push({ id: c.id, expected: c.expected, got: conv.level, signals });
  const mark = conv.level === c.expected ? "ok " : "!! ";
  console.log(`${mark}${c.id.padEnd(28)} expected=${c.expected.padEnd(9)} got=${conv.level}`);
}

const high = rows.filter((r) => atLeast(r.expected, "ELEVATED"));
const crisis = rows.filter((r) => r.expected === "CRISIS");
const benign = rows.filter((r) => r.expected === "NONE");
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

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(here("./results"), { recursive: true });
const out = here(`./results/${stamp}.jsonl`);
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`per-case signals written to evals/results/${stamp}.jsonl`);
