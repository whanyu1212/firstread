/**
 * Sweep the conversation-level risk settings (risk.ts) offline, on the signals a run of
 * `pnpm eval:conversations` recorded. Uses the real updateRisk(), so what's tuned here is what
 * ships. Tune on dev only; confirm the chosen settings once on holdout with a live run.
 *
 *     pnpm sweep:risk                          # latest dev run
 *     pnpm sweep:risk evals/results/<file>.jsonl
 *
 * Valid because the settings swept here (score, settling, calm) don't change what Jev is shown:
 * the ledger holds every message whose own reading is WATCH or above, whatever the settings.
 * The context rule (part 2) does depend on the level, so it's swept too, from the same signals.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_RISK_CONFIG, type RiskConfig, type RiskLevel, type UserSignals, assessLevel, escalate, initialRisk, updateRisk } from "../src";
import { type LabelledConversation, loadConversations, scoreConversation } from "./conversations";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const file =
  process.argv[2] ??
  here(
    `./results/${readdirSync(here("./results"))
      .filter((f) => /^conversations-dev-jev-/.test(f))
      .sort()
      .at(-1)}`,
  );
const rows: { id: string; signals: UserSignals[]; error?: string }[] = readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const byId = new Map(loadConversations(here("./conversations.jsonl")).map((c) => [c.id, c]));
const runs = rows
  .filter((r) => !r.error && byId.get(r.id)?.split === "dev")
  .map((r) => ({ c: byId.get(r.id)!, signals: r.signals }));
console.log(`${runs.length} dev conversations from ${file.split("/").at(-1)}\n`);

/** null config: the policy before HY-154 (each turn's own level, never coming down). */
function evaluate(config: RiskConfig | null) {
  let missed = 0;
  let late = 0;
  let overConvs = 0;
  let overExchanges = 0;
  let settledOnTime = 0;
  let settling = 0;
  for (const { c, signals } of runs) {
    let state = initialRisk();
    let sticky: RiskLevel = "NONE";
    const levels: RiskLevel[] = signals.map((p, i) => {
      if (!config) return (sticky = escalate(sticky, assessLevel(p)));
      // Older runs predate asks_for_person; it doesn't affect the level.
      state = updateRisk(state, { ...p, asks_for_person: p.asks_for_person ?? 0 }, { text: c.exchanges[i]!.user }, config);
      return state.level;
    });
    const s = scoreConversation(c as LabelledConversation, levels);
    if (s.missed) missed++;
    if ((s.delay ?? 0) > 0) late++;
    if (s.overCeiling.length) overConvs++;
    overExchanges += s.overCeiling.length;
    if (s.settled !== null) {
      settling++;
      if (typeof s.settled === "number") settledOnTime++;
    }
  }
  return { missed, late, overConvs, overExchanges, settledOnTime, settling };
}

const grid: RiskConfig[] = [];
for (const decay of [0.5, 0.6, 0.7])
  for (const evidenceFloor of [0.2, 0.3])
    for (const scoreWatch of [0.4, 0.5, 0.7, 0.9])
      for (const scoreElevated of [0.8, 1.0, 1.3])
        for (const settleAfter of [3, 4, 5])
          for (const calmEvidence of [0.1, 0.15, 0.2])
            grid.push({ ...DEFAULT_RISK_CONFIG, decay, evidenceFloor, scoreWatch, scoreElevated, settleAfter, calmEvidence });

// Recall first: no misses, nothing late. Then fewest over the ceiling, then most settled on time.
const results = grid
  .map((config) => ({ config, r: evaluate(config) }))
  .sort(
    (a, b) =>
      a.r.missed + a.r.late - (b.r.missed + b.r.late) ||
      a.r.overConvs - b.r.overConvs ||
      a.r.overExchanges - b.r.overExchanges ||
      b.r.settledOnTime - a.r.settledOnTime,
  );

const line = (label: string, config: RiskConfig, r: ReturnType<typeof evaluate>) =>
  `${label.padEnd(9)} decay ${config.decay} floor ${config.evidenceFloor} watch ${config.scoreWatch} elev ${config.scoreElevated} ` +
  `settle ${config.settleAfter} calm ${config.calmEvidence} | missed ${r.missed} late ${r.late} | over ${r.overConvs} convs ` +
  `${r.overExchanges} exch | settled ${r.settledOnTime}/${r.settling}`;

const before = evaluate(null);
console.log(
  `before    each turn's level, never coming down       | missed ${before.missed} late ${before.late} | over ${before.overConvs} convs ${before.overExchanges} exch | settled ${before.settledOnTime}/${before.settling}`,
);
console.log(line("default", DEFAULT_RISK_CONFIG, evaluate(DEFAULT_RISK_CONFIG)));
console.log("");
results.slice(0, 12).forEach(({ config, r }, i) => console.log(line(`#${i + 1}`, config, r)));
