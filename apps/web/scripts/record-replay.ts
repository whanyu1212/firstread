/**
 * Record scripted scenarios through the real turn pipeline, for the demo's keyless replays (HY-166)
 * and the deck's replay slide (HY-159). Each turn keeps exactly the data parts the page receives,
 * so a replay renders with the same components as a live chat.
 *
 *     pnpm --filter web dev                                  # in another terminal; uses OPENAI_API_KEY from .env
 *     pnpm --filter web record:replay crisis                 # one scenario
 *     pnpm --filter web record:replay all                    # every scenario
 *     pnpm --filter web record:replay all --out /tmp/rec     # somewhere to look at first
 *     node --env-file=.env node_modules/.pnpm/node_modules/tsx/dist/cli.mjs \
 *       --conditions=react-server apps/web/scripts/record-replay.ts crisis --local # includes original drafts
 *
 * A scenario taken from the multi-turn eval set (`evalId`) is scored with the same labels and
 * failures as `pnpm eval:conversations`. A run that goes over a ceiling, misses or is late to its
 * target, stays flagged after recovery or doesn't settle in time isn't written unless you pass --force; record it again or fix the scenario. Writes
 * slides/data/replay-<scenario>.json. Spends Jev and OpenAI credits. DEMO_URL sets the server.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { DEFAULT_RISK_CONFIG, type FirstRead, type RiskLevel } from "firstread";
import { loadConversations, scoreConversation, ceilingAt } from "../../../packages/firstread/evals/conversations";
import type { ChatData } from "../lib/chat";
import type { RecordedTurn, Recording } from "../lib/replay";
import { SCENARIOS, type Scenario } from "../lib/scenarios";
import { emptySession, MAX_NOTES, type Session } from "../lib/session";

const { values: args, positionals } = parseArgs({
  options: {
    out: { type: "string" },
    force: { type: "boolean", default: false },
    local: { type: "boolean", default: false },
  },
  allowPositionals: true,
});
const BASE = process.env.DEMO_URL ?? "http://localhost:3000";
const ids = positionals[0] === "all" ? SCENARIOS.map((s) => s.id) : positionals.length ? positionals : ["crisis"];
const outDir = args.out ?? new URL("../slides/data", import.meta.url).pathname;
const conversations = loadConversations(
  new URL("../../../packages/firstread/evals/conversations.jsonl", import.meta.url).pathname,
);

/** One turn through /api/chat: the UI message stream, read as server-sent events. */
async function turn(chatId: string, text: string): Promise<RecordedTurn> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: chatId,
      message: { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`chat route answered ${res.status}: ${await res.text()}`);
  const data: Partial<Record<keyof ChatData, unknown>> = {};
  let reply = "";
  for (const line of (await res.text()).split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    const part = JSON.parse(line.slice(6)) as { type: string; delta?: string; data?: unknown; errorText?: string };
    if (part.type === "text-delta") reply += part.delta ?? "";
    else if (part.type === "error") throw new Error(`stream error: ${part.errorText}`);
    else if (part.type.startsWith("data-")) data[part.type.slice(5) as keyof ChatData] = part.data;
  }
  return { user: text, reply, data: data as Partial<ChatData> };
}

/**
 * An opt-in synthetic recorder that runs the same turn pipeline as the route. It is deliberately
 * separate from the public endpoint: only this local process receives the companion's draft.
 */
async function localRecorder(): Promise<(text: string) => Promise<RecordedTurn>> {
  const [{ COMPANION_MODEL, draftReply }, { liveGuard }, { extractNotes }, { runTurn }] = await Promise.all([
    import("../lib/companion"),
    import("../lib/firstread"),
    import("../lib/notes"),
    import("../lib/turn"),
  ]);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("local recording needs OPENAI_API_KEY");
  const guard: FirstRead | null = liveGuard();
  if (!guard) throw new Error("local recording needs a configured Jev client");
  const session: Session = emptySession();

  return async (text) => {
    let draft: string | undefined;
    const data: Partial<ChatData> = {};
    const result = await runTurn(
      text,
      session,
      {
        guard,
        draft: async (input) => {
          const value = await draftReply({ apiKey, ...input });
          draft = value.reply;
          return value;
        },
      },
      (check, ms) => {
        data.check = check.ok ? { ok: true, level: check.level, ms } : { ok: false, reason: check.reason, ms };
      },
    );
    // Provider error objects may contain credentials; don't print them from this CLI.
    if (result.draftError) throw new Error("The companion could not produce a draft; recording not saved.");

    const { audit, exercise, handoff, shortCircuit, timings } = result;
    data.audit = {
      level: audit.level,
      action: audit.action,
      failures: audit.failures,
      userSignals: audit.userSignals,
      replySignals: audit.replySignals,
      shortCircuit,
    };
    if (handoff) data.handoff = { reason: handoff.reason };
    if (exercise) data.exercise = { id: exercise.id, name: exercise.name, steps: [...exercise.steps] };
    data.timing = { model: COMPANION_MODEL, ...timings };
    const risk = session.conv.risk;
    data.risk = {
      level: risk.level,
      peak: risk.peak,
      score: risk.score,
      history: risk.history,
      changes: risk.changes,
      ledger: risk.ledger.map(({ text, level }) => ({ text, level })),
      thresholds: { watch: DEFAULT_RISK_CONFIG.scoreWatch, elevated: DEFAULT_RISK_CONFIG.scoreElevated },
    };

    // Match the route's memory rule before the next synthetic turn. The public route does this in
    // after(); here it is awaited so a recording has deterministic sequential state.
    if (audit.action === "send" && audit.failures.length === 0 && session.notes.length < MAX_NOTES) {
      const found = await extractNotes({ apiKey, userText: text, known: session.notes });
      session.notes = [...session.notes, ...found].slice(0, MAX_NOTES);
    }

    return { user: text, reply: audit.reply, ...(draft === undefined ? {} : { draft }), data };
  };
}

/** Problems with a recording against its eval conversation's labels; empty when it passes. */
function labelProblems(scenario: Scenario, levels: RiskLevel[]): string[] {
  if (!scenario.evalId) return [];
  const c = conversations.find((x) => x.id === scenario.evalId);
  if (!c) return [`eval conversation ${scenario.evalId} not found`];
  if (c.exchanges.length !== levels.length) return [`${levels.length} turns, but ${c.id} has ${c.exchanges.length} exchanges`];
  const problems: string[] = [];
  const drifted = scenario.messages.flatMap((m, i) => (m === c.exchanges[i]!.user ? [] : [i + 1]));
  if (drifted.length) problems.push(`messages differ from ${c.id} at ${drifted.join(", ")}, so its labels may not apply`);
  const score = scoreConversation(c, levels);
  if (score.overCeiling.length) {
    problems.push(`over the ceiling at ${score.overCeiling.map((n) => `${n} (${levels[n - 1]} > ${ceilingAt(c, n)})`).join(", ")}`);
  }
  if (score.missed) problems.push(`never reached ${c.target}`);
  if (score.delay !== null && score.delay > 0) problems.push(`reached ${c.target} ${score.delay} exchange(s) after detect_by`);
  if (score.flaggedAfterRecovery) problems.push(`ELEVATED or above on ${score.flaggedAfterRecovery} turn(s) after recovery_from`);
  if (score.settled === "never" || score.settled === "late") problems.push(`settled ${score.settled}`);
  return problems;
}

mkdirSync(outDir, { recursive: true });
let refused = 0;
for (const id of ids) {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) throw new Error(`unknown scenario "${id}"; one of: all, ${SCENARIOS.map((s) => s.id).join(", ")}`);
  console.log(`\n${scenario.title}${scenario.evalId ? ` (labels: ${scenario.evalId})` : ""}`);
  const chatId = crypto.randomUUID();
  const record = args.local ? await localRecorder() : (text: string) => turn(chatId, text);
  const turns: RecordedTurn[] = [];
  for (const text of scenario.messages) {
    const t = await record(text);
    turns.push(t);
    console.log(`  ${(t.data.risk?.level ?? "?").padEnd(8)} ${(t.data.audit?.action ?? "?").padEnd(8)} ${text}`);
  }
  const unread = turns.flatMap((t, i) => (t.data.risk ? [] : [i + 1]));
  const problems = unread.length
    ? [`no risk level on turn ${unread.join(", ")}`]
    : labelProblems(scenario, turns.map((t) => t.data.risk!.level));
  for (const p of problems) console.log(`  ✗ ${p}`);
  if (problems.length && !args.force) {
    console.log("  not written (pass --force to keep it anyway)");
    refused++;
    continue;
  }
  const recording: Recording = { scenario: scenario.id, title: scenario.title, recordedAt: new Date().toISOString(), turns };
  const target = `${outDir}/replay-${scenario.id}.json`;
  writeFileSync(target, `${JSON.stringify(recording, null, 1)}\n`);
  console.log(`  wrote ${target}`);
}
if (refused) process.exitCode = 1;
