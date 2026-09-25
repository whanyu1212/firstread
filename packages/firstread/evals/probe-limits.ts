/**
 * Measure where Jev starts refusing requests (429 rate limits, 503s) at steady request rates.
 *
 *     pnpm probe:limits                                   # 0.25, 0.5, 1, 2 req/s for 60s each
 *     pnpm probe:limits --rates 1,3 --duration 30
 *
 * Retries are off, so every refusal is visible. Requests are sent on a fixed schedule whether
 * or not earlier ones have answered, like real traffic. The state is a fixed, harmless message
 * (no dataset text) with the real user-check questions, so each request is the same size as a
 * live one. Stops stepping up once a phase is mostly refused, and waits out any Retry-After
 * before the next phase.
 *
 * A 429 body with "type": "rate_limit_exceeded" comes from AI Gateway (free-tier limit);
 * anything else is from TypeSafe upstream.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { USER_TURN_QUESTIONS, clientConfig } from "../src";

type Rec = {
  phase: number;
  rps: number;
  sentAt: number; // ms since phase start
  status: number | null; // null: no HTTP response (connection error, timeout)
  ms: number;
  headers?: Record<string, string>;
  body?: string;
};

const STATE =
  "CONVERSATION SO FAR: (none)\n\nLATEST USER MESSAGE:\nhad a long day at work, going to make pasta and watch a movie";
const INTERESTING_HEADER = /limit|retry|quota|request-id|x-vercel-id|x-matched-path/i;

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const { values: args } = parseArgs({
  options: {
    rates: { type: "string", default: "0.25,0.5,1,2" },
    duration: { type: "string", default: "60" },
  },
});
const rates = args.rates.split(",").map(Number);
const durationS = Number(args.duration);

try {
  process.loadEnvFile(here("../../../.env"));
} catch {
  // fine if the key is already in the environment
}
const config = clientConfig();

/** One request, retries off, capturing status, headers and error body. */
async function probe(phase: number, rps: number, sentAt: number): Promise<Rec> {
  const rec: Rec = { phase, rps, sentAt, status: null, ms: 0 };
  const client = new TypeSafeClient({
    ...config,
    timeout: 15_000,
    retry: { maxRetries: 0 },
    logLevel: "off",
    fetch: async (input, init) => {
      const res = await fetch(input, init);
      rec.status = res.status;
      if (!res.ok) {
        rec.headers = Object.fromEntries([...res.headers].filter(([k]) => INTERESTING_HEADER.test(k)));
        rec.body = (await res.clone().text()).slice(0, 300);
      }
      return res;
    },
  });
  const start = performance.now();
  try {
    await client.systemOne({ state: STATE, questions: USER_TURN_QUESTIONS });
  } catch {
    // status/body already captured; null status means no HTTP response
  }
  rec.ms = Math.round(performance.now() - start);
  return rec;
}

async function runPhase(phase: number, rps: number): Promise<Rec[]> {
  const n = Math.max(1, Math.round(rps * durationS));
  const start = performance.now();
  const pending: Promise<Rec>[] = [];
  for (let i = 0; i < n; i++) {
    const at = (i * 1000) / rps;
    await sleep(Math.max(0, at - (performance.now() - start)));
    pending.push(probe(phase, rps, Math.round(performance.now() - start)));
  }
  return Promise.all(pending);
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;

function summarise(recs: Rec[]) {
  const count = (s: number | null) => recs.filter((r) => r.status === s).length;
  const ok = recs.filter((r) => r.status === 200).map((r) => r.ms).sort((a, b) => a - b);
  const limited = recs.filter((r) => r.status === 429);
  const retryAfter = [...new Set(limited.map((r) => r.headers?.["retry-after"]).filter(Boolean))];
  return {
    sent: recs.length,
    ok: ok.length,
    r429: limited.length,
    r503: count(503),
    other: recs.length - ok.length - limited.length - count(503),
    firstRefusalAt: recs.find((r) => r.status !== 200)?.sentAt ?? null,
    p50: percentile(ok, 0.5),
    p95: percentile(ok, 0.95),
    retryAfter,
  };
}

console.log(`probing ${rates.join(", ")} req/s for ${durationS}s each (retries off)\n`);
console.log("req/s   sent   200   429   503  other  first refusal   p50/p95 ok ms   retry-after");
const all: Rec[] = [];
for (const [phase, rps] of rates.entries()) {
  const recs = await runPhase(phase, rps);
  all.push(...recs);
  const s = summarise(recs);
  console.log(
    `${String(rps).padEnd(6)} ${String(s.sent).padStart(5)} ${String(s.ok).padStart(5)} ${String(s.r429).padStart(5)} ${String(s.r503).padStart(5)} ${String(s.other).padStart(6)}  ${(s.firstRefusalAt === null ? "-" : `${(s.firstRefusalAt / 1000).toFixed(1)}s`).padStart(13)}   ${`${s.p50}/${s.p95}`.padStart(13)}   ${s.retryAfter.join(",") || "-"}`,
  );

  if (s.r429 > s.sent / 2) {
    console.log("mostly rate limited; not stepping up further");
    break;
  }
  if (phase < rates.length - 1) {
    const waitS = s.r429 ? Math.max(30, ...s.retryAfter.map(Number).filter(Number.isFinite)) + 5 : 10;
    await sleep(waitS * 1000);
  }
}

const samples = (status: number) => all.filter((r) => r.status === status).slice(0, 2);
for (const status of [429, 503]) {
  for (const r of samples(status)) {
    console.log(`\nsample ${status} (at ${r.rps} req/s): headers ${JSON.stringify(r.headers)}\n  body ${r.body}`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(here("./results"), { recursive: true });
writeFileSync(here(`./results/probe-${stamp}.jsonl`), all.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`\nper-request records written to evals/results/probe-${stamp}.jsonl`);
