/**
 * Replay the multi-turn conversations through the whole demo turn pipeline (runTurn): real Jev,
 * the real companion, the CRISIS short circuit and fail-closed, scored with the same labels as
 * `pnpm eval:conversations`. Opt-in: it spends Jev and OpenAI credits.
 *
 *     pnpm --filter web eval:pipeline                    # dev split
 *     pnpm --filter web eval:pipeline --split holdout --concurrency 4
 *
 * Unlike eval:conversations, the companion's real replies replace the scripted ones, so FirstRead
 * sees what it would see live. Labels assume a supportive companion, which this one is.
 */

import { parseArgs } from "node:util";
import { FirstRead, type RiskLevel } from "firstread";
import {
  CATEGORIES,
  type LabelledConversation,
  loadConversations,
  scoreConversation,
} from "../../../packages/firstread/evals/conversations";
import { draftReply } from "../lib/companion";
import { DEMO_REPLIES } from "../lib/replies";
import { emptySession } from "../lib/session";
import { runTurn } from "../lib/turn";

process.loadEnvFile(new URL("../../../.env", import.meta.url).pathname);
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Set OPENAI_API_KEY in .env");

const { values: args } = parseArgs({
  options: { split: { type: "string", default: "dev" }, concurrency: { type: "string", default: "4" } },
});
const conversations = loadConversations(
  new URL("../../../packages/firstread/evals/conversations.jsonl", import.meta.url).pathname,
).filter((c) => args.split === "all" || c.split === args.split);
const guard = new FirstRead({ replies: DEMO_REPLIES });
const SHORT: Record<RiskLevel, string> = { NONE: "·", WATCH: "W", ELEVATED: "E", CRISIS: "C" };

type Row = { c: LabelledConversation; levels: RiskLevel[]; totals: number[]; short: number; failed: number; error?: string };

async function replay(c: LabelledConversation): Promise<Row> {
  const session = emptySession();
  const row: Row = { c, levels: [], totals: [], short: 0, failed: 0 };
  try {
    for (const x of c.exchanges) {
      const r = await runTurn(x.user, session, {
        guard,
        draft: ({ history, text, notes, signal }) => draftReply({ apiKey: apiKey!, history, text, notes, signal }),
      });
      row.levels.push(r.audit.level);
      row.totals.push(r.timings.totalMs);
      if (r.shortCircuit) row.short++;
      if (r.audit.failures.length || r.draftError) row.failed++;
    }
  } catch (error) {
    row.error = String(error).slice(0, 120);
  }
  return row;
}

const rows: Row[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: Number(args.concurrency) }, async () => {
    for (let c = conversations[next++]; c; c = conversations[next++]) {
      rows.push(await replay(c));
      process.stdout.write(`  ${rows.length}/${conversations.length}\r`);
    }
  }),
);
rows.sort((a, b) => CATEGORIES.indexOf(a.c.category) - CATEGORIES.indexOf(b.c.category));

console.log(`\n${conversations.length} ${args.split} conversations through the full pipeline\n`);
let missed = 0;
let over = 0;
for (const r of rows) {
  if (r.error) {
    console.log(`${r.c.id.padEnd(29)} ERROR ${r.error}`);
    continue;
  }
  const s = scoreConversation(r.c, r.levels);
  if (s.missed) missed++;
  if (s.overCeiling.length) over++;
  const result = [
    s.missed ? "MISSED" : s.delay === null ? "ok" : s.delay > 0 ? `late +${s.delay}` : "on time",
    s.overCeiling.length ? `over ceiling at #${s.overCeiling.join(",#")}` : "",
    r.failed ? `${r.failed} failed closed` : "",
  ]
    .filter(Boolean)
    .join(", ");
  console.log(`${r.c.id.padEnd(29)} ${r.levels.map((l) => SHORT[l]).join(" ").padEnd(14)} ${result}`);
}

const totals = rows.flatMap((r) => r.totals).sort((a, b) => a - b);
const pct = (p: number) => ((totals[Math.min(totals.length - 1, Math.floor(p * totals.length))] ?? 0) / 1000).toFixed(1);
const targeted = rows.filter((r) => r.c.target).length;
console.log(`\nmissed: ${missed} of ${targeted} that should escalate · over the ceiling: ${over} of ${rows.length}`);
console.log(`short circuits: ${rows.reduce((n, r) => n + r.short, 0)} turns · failed closed: ${rows.reduce((n, r) => n + r.failed, 0)} turns`);
console.log(`time to reply per turn: p50 ${pct(0.5)}s  p90 ${pct(0.9)}s  max ${pct(1)}s  (${totals.length} turns)`);
