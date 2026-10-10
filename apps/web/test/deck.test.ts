import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { levelEvidence } from "firstread/policy";
import { describe, expect, it } from "vitest";
import { LADDER_TURN, ladder } from "@/lib/ladder";
import { RECORDINGS } from "@/lib/recordings";

/** The (signal, cutoff) pairs of a ladder's lit rules, as levelEvidence() reports answers. */
const litAnswers = (signals: Parameters<typeof ladder>[0]) =>
  ladder(signals)
    .rules.filter((r) => r.lit)
    .flatMap((r) => r.parts.filter((p) => p.value >= p.cutoff))
    .map((p) => `${p.signal}>=${p.cutoff}`)
    .sort();
const evidenceAnswers = (signals: Parameters<typeof ladder>[0]) =>
  levelEvidence(signals)
    .answers.map((a) => `${a.signal}>=${a.cutoff}`)
    .sort();

describe("the answers-to-a-level slide", () => {
  const signals = LADDER_TURN.data.audit!.userSignals!;

  it("shows the level levelEvidence gives its message, and the level the recording got", () => {
    expect(ladder(signals).level).toBe(levelEvidence(signals).level);
    expect(ladder(signals).level).toBe(LADDER_TURN.data.audit!.level);
  });

  it("lights exactly the rules levelEvidence gives as the reason, with the same cutoffs", () => {
    expect(litAnswers(signals)).toEqual(evidenceAnswers(signals));
    expect(litAnswers(signals).length).toBeGreaterThan(0);
  });

  it("never lights a rule that wasn't part of the reason, on any recorded message", () => {
    const turns = Object.values(RECORDINGS).flatMap((r) => r.turns);
    for (const t of turns) {
      const s = t.data.audit?.userSignals;
      if (!s) continue;
      const evidence = new Set(evidenceAnswers(s));
      for (const answer of litAnswers(s)) expect(evidence.has(answer), t.user).toBe(true);
    }
  });
});

describe("slide build steps", () => {
  it("match the highest `at` on each slide", () => {
    // index.ts imports MDX, which vitest doesn't compile, so read the step counts from its source.
    const dir = path.resolve(import.meta.dirname, "../slides");
    const index = readFileSync(path.join(dir, "index.ts"), "utf8");
    const imports = new Map([...index.matchAll(/import (\w+) from "\.\/(.+\.mdx)"/g)].map((m) => [m[1]!, m[2]!]));
    const entries = [...index.matchAll(/steps: (\d+), Content: (\w+)/g)].map((m) => ({ steps: Number(m[1]), file: imports.get(m[2]!)! }));
    // Every slide file is in the deck, once.
    expect(entries.map((e) => e.file).sort()).toEqual(readdirSync(dir).filter((f) => f.endsWith(".mdx")).sort());
    for (const { steps, file } of entries) {
      const ats = [...readFileSync(path.join(dir, file), "utf8").matchAll(/at=\{(\d+)\}/g)].map((m) => Number(m[1]));
      expect(Math.max(0, ...ats), file).toBe(steps);
    }
  });
});
