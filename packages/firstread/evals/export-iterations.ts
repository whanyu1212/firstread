/**
 * Export the BHH iteration history for the deck's iteration-loop slide (HY-168): SI/self-harm
 * recall at >= ELEVATED and the no_crisis false-alarm rate after each change to the questions or
 * the policy, so the slide shows measured numbers, not ones typed in.
 *
 *     pnpm export:iterations
 *
 * Each step rescores one saved BHH test run with the policy exactly as it was at a commit (read
 * with `git show`, not a replica), and where the run recorded its own levels, checks that the
 * rescore gives the same ones. Writes apps/web/slides/data/iterations.json; commit it with the
 * results it was built from (results files are gitignored).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { RiskLevel, UserSignals } from "../src";
import { NEGATIVE, POSITIVE } from "./bhh-metrics";
import type { BhhLabel } from "./fetch-bhh";

type Row = { id: string; label: BhhLabel; got: RiskLevel | null; signals: UserSignals | null };

interface Step {
  /** What changed, as the slide says it. */
  change: string;
  /** What the miss was that led to it. */
  miss: string;
  /** The commit whose policy scores the run. */
  commit: string;
  /** A BHH test run whose questions match that commit's. */
  results: string;
  /** The run's own `got` levels came from this policy, so the rescore must reproduce them. */
  recorded: boolean;
}

const STEPS: Step[] = [
  {
    change: "Columbia-style questions",
    miss: "Where we started: one cutoff per question, per level.",
    commit: "c6e97c5^",
    results: "bhh-test-2026-09-25T07-39-50-605Z.jsonl",
    // The run already asked the follow-up questions; this policy ignores them.
    recorded: false,
  },
  {
    change: "Follow-up questions for borderline turns",
    miss: "Weak signals that add up, with no one answer high enough on its own.",
    commit: "c6e97c5",
    results: "bhh-test-2026-09-25T07-39-50-605Z.jsonl",
    recorded: true,
  },
  {
    change: "A question about preparation",
    miss: "Goodbye letters and gathering means reached CRISIS only by accident, or not at all.",
    commit: "5ddbd89",
    results: "bhh-test-2026-09-25T10-41-25-619Z.jsonl",
    recorded: true,
  },
];

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const git = (...args: string[]) => execFileSync("git", args, { cwd: here("."), encoding: "utf8" }).trim();
const pct = (n: number, d: number) => Number(((100 * n) / d).toFixed(1));
const rank = (l: RiskLevel) => ["NONE", "WATCH", "ELEVATED", "CRISIS"].indexOf(l);

const scratch = mkdtempSync(join(tmpdir(), "firstread-policy-"));
try {
  const steps = [];
  for (const step of STEPS) {
    const sha = git("rev-parse", "--short", step.commit);
    // The policy file imports only types, so it runs on its own.
    const file = join(scratch, `policy-${sha}.ts`);
    writeFileSync(file, git("show", `${sha}:packages/firstread/src/policy.ts`));
    const { assessLevel } = (await import(pathToFileURL(file).href)) as { assessLevel: (p: UserSignals) => RiskLevel };

    const rows = readFileSync(here(`./results/${step.results}`), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Row);
    // A failed case dropped here would leave the denominators and flatter recall, so refuse the run.
    const failed = rows.filter((r) => !r.signals);
    if (failed.length) throw new Error(`${step.results}: ${failed.length} cases have no signals, e.g. ${failed[0]!.id}`);
    if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error(`${step.results}: duplicate case ids`);
    const scored = rows.map((r) => ({ ...r, level: assessLevel(r.signals!) }));
    if (step.recorded) {
      const differ = scored.filter((r) => r.level !== r.got);
      if (differ.length) {
        throw new Error(`${sha} on ${step.results}: ${differ.length} levels differ from the run's own, e.g. ${differ[0]!.id}`);
      }
    }
    const pos = scored.filter((r) => POSITIVE.includes(r.label));
    const neg = scored.filter((r) => r.label === NEGATIVE);
    if (!pos.length || !neg.length) throw new Error(`${step.results}: no positive or no negative cases`);
    const atLeast = (rs: typeof scored, min: RiskLevel) => rs.filter((r) => rank(r.level) >= rank(min)).length;
    steps.push({
      change: step.change,
      miss: step.miss,
      commit: sha,
      date: git("show", "-s", "--format=%as", sha),
      results: step.results,
      /** SI/self-harm messages at ELEVATED or above. */
      recall: pct(atLeast(pos, "ELEVATED"), pos.length),
      /** no_crisis messages at ELEVATED or above: the false-alarm cost. */
      falseAlarms: pct(atLeast(neg, "ELEVATED"), neg.length),
      cases: { positive: pos.length, negative: neg.length },
    });
  }

  const conversations = readFileSync(here("./conversations.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { split: string });
  const out = {
    source: "BHH test split, SI/self-harm vs no_crisis; each run rescored with its commit's policy.ts",
    steps,
    /** Multi-turn conversations by split: holdout is only run to confirm, never to tune. */
    conversations: {
      dev: conversations.filter((c) => c.split === "dev").length,
      holdout: conversations.filter((c) => c.split === "holdout").length,
    },
  };
  const target = here("../../../apps/web/slides/data/iterations.json");
  writeFileSync(target, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`wrote ${target}`);
  for (const s of steps) console.log(`  ${s.commit} ${s.change}: recall ${s.recall}%, false alarms ${s.falseAlarms}%`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
