import { describe, expect, it } from "vitest";
import { Conversation, FirstRead } from "../src/guard";
import type { AskOptions, JevClient } from "../src/jev";
import type { UserSignals } from "../src/questions";
import {
  DEFAULT_RISK_CONFIG,
  type RiskConfig,
  type RiskState,
  clearCrisis,
  initialRisk,
  ledgerOutsideWindow,
  resourcesDue,
  resourcesGiven,
  updateRisk,
} from "../src/risk";

const QUIET: UserSignals = {
  ideation: 0,
  self_harm: 0,
  method_seeking: 0,
  plan: 0,
  means: 0,
  intent: 0,
  preparation: 0,
  imminent: 0,
  harm_to_others: 0,
  own_death_wish: 0,
  disguised_request: 0,
  counselor_concern: 0,
  asks_for_person: 0,
  latest_adds_risk: 0,
};
/**
 * A turn's signals. Unless a test says otherwise, a turn with any risk signal adds risk
 * (latest_adds_risk 0.8) and a turn with none is calm (0).
 */
const sig = (p: Partial<UserSignals> = {}): UserSignals => {
  const anySignal = Object.entries(p).some(([k, v]) => k !== "latest_adds_risk" && v >= 0.1);
  return { ...QUIET, latest_adds_risk: anySignal ? 0.8 : 0, ...p };
};

/** Run a sequence of turns from a starting state. */
function run(turns: Partial<UserSignals>[], start: RiskState = initialRisk(), config = DEFAULT_RISK_CONFIG): RiskState {
  return turns.reduce(
    (state, p, i) => updateRisk(state, sig(p), { text: `message ${i + 1}` }, config),
    start,
  );
}

/** Fixed settings for testing each mechanism; the defaults are tuned on the evals and may move. */
const TEST_CONFIG: RiskConfig = {
  ...DEFAULT_RISK_CONFIG,
  evidenceFloor: 0.2,
  decay: 0.6,
  scoreWatch: 0.5,
  scoreElevated: 1.0,
  settleAfter: 4,
  resourcesRecent: 1,
  resourcesEvery: 3,
};

describe("evidence-backed CRISIS (part 2)", () => {
  it("holds an imminence or plan-and-means reading with no self-harm context at ELEVATED", () => {
    // serious-gaming: "launch my pc out the window"
    const s = run([{ plan: 0.5, means: 0.7, imminent: 0.51, ideation: 0.09, self_harm: 0.22 }]);
    expect(s.level).toBe("ELEVATED");
    expect(s.changes.at(-1)?.reason).toMatch(/without self-harm context/);
  });

  it("escalates the same reading with self-harm context", () => {
    expect(run([{ imminent: 0.6, ideation: 0.8 }]).level).toBe("CRISIS");
    expect(run([{ plan: 0.4, means: 0.4, self_harm: 0.5 }]).level).toBe("CRISIS");
  });

  it("counts an already raised conversation as context", () => {
    expect(run([{ ideation: 0.9 }, { plan: 0.4, means: 0.4 }]).level).toBe("CRISIS");
  });

  it("holds an echo of an earlier message at ELEVATED: a topic change right after a disclosure", () => {
    // recovery-changes-subject #2, "can you recommend a podcast": imminent carried from the turn before
    const s = run([{ ideation: 0.98, self_harm: 0.6 }, { imminent: 0.41, self_harm: 0.77, latest_adds_risk: 0.03 }]);
    expect(s.level).toBe("ELEVATED");
  });

  it("lets intent and preparation stand alone", () => {
    expect(run([{ intent: 0.6 }]).level).toBe("CRISIS");
    // prep-heldout-savings: preparation 0.56, low ideation
    expect(run([{ preparation: 0.56 }]).level).toBe("CRISIS");
  });
});

describe("building score (part 3)", () => {
  // Each signal below its own per-turn threshold (this turn alone reads NONE), each message adding a little.
  const weak = { ideation: 0.14, self_harm: 0.14, plan: 0.15, means: 0.15, latest_adds_risk: 0.45 };

  it("lets repeated weak evidence raise the level, where one turn wouldn't", () => {
    expect(run([weak], initialRisk(), TEST_CONFIG).level).toBe("NONE");
    const built = run([weak, weak, weak, weak], initialRisk(), TEST_CONFIG);
    expect(built.level).toBe("WATCH");
    expect(built.changes.at(-1)?.reason).toMatch(/evidence building/);
  });

  it("can reach ELEVATED from the score, never CRISIS", () => {
    const strong = { ideation: 0.38, self_harm: 0.28, plan: 0.15, means: 0.15, latest_adds_risk: 0.7 }; // reads WATCH per turn
    const s = run(Array(20).fill(strong), initialRisk(), TEST_CONFIG);
    expect(s.level).toBe("ELEVATED");
  });

  it("ignores background noise below the floor", () => {
    const s = run(Array(20).fill({ ideation: 0.05, self_harm: 0.05, latest_adds_risk: 0.1 }), initialRisk(), TEST_CONFIG);
    expect(s.level).toBe("NONE");
  });

  it("doesn't count an earlier message again on calm turns", () => {
    // After a disclosure, Jev's contextual signals stay high, but the messages add nothing.
    const echo = { self_harm: 0.29, own_death_wish: 0.72, plan: 0.15, latest_adds_risk: 0.03 };
    const s = run([{ ideation: 0.97 }, echo, echo, echo, echo, echo], initialRisk(), TEST_CONFIG);
    expect(s.score).toBeLessThan(TEST_CONFIG.scoreElevated);
    expect(s.level).toBe("WATCH"); // settled despite the echoes
  });
});

describe("coming down (part 5)", () => {
  const elevated = run([{ ideation: 0.9 }]);
  const calm = Array(DEFAULT_RISK_CONFIG.settleAfter).fill({});

  it("settles ELEVATED to WATCH after calm turns, with a reason", () => {
    const s = run(calm, elevated);
    expect(s.level).toBe("WATCH");
    expect(s.peak).toBe("ELEVATED");
    expect(s.changes.at(-1)).toMatchObject({ from: "ELEVATED", to: "WATCH" });
  });

  it("doesn't settle if a signal interrupts the calm stretch", () => {
    const s = run([{}, {}, { ideation: 0.2 }, {}, {}], elevated);
    expect(s.level).toBe("ELEVATED");
  });

  it("doesn't rise again from an echo once settled, but does on a new signal", () => {
    const echo = { self_harm: 0.5, own_death_wish: 0.7, latest_adds_risk: 0.03 };
    const settled = run(Array(DEFAULT_RISK_CONFIG.settleAfter).fill(echo), elevated);
    expect(settled.level).toBe("WATCH");
    expect(run([echo, echo], settled).level).toBe("WATCH");
    expect(run([{ ideation: 0.9 }], settled).level).toBe("ELEVATED");
  });

  it("never settles to NONE", () => {
    expect(run(Array(30).fill({}), elevated).level).toBe("WATCH");
  });

  it("never lets CRISIS come down on its own", () => {
    expect(run(Array(30).fill({}), run([{ intent: 0.9 }])).level).toBe("CRISIS");
  });

  it("lets a person clear CRISIS to ELEVATED, recorded", () => {
    const s = clearCrisis(run([{ intent: 0.9 }]), "reviewer@demo", "2026-10-07T00:00:00Z");
    expect(s.level).toBe("ELEVATED");
    expect(s.clearedBy).toEqual({ reviewer: "reviewer@demo", at: "2026-10-07T00:00:00Z" });
    expect(s.changes.at(-1)?.reason).toMatch(/cleared by reviewer@demo/);
  });
});

describe("support lines (part 4)", () => {
  it("are due when the signal is new, then as periodic check-ins", () => {
    const noSettle = { ...TEST_CONFIG, settleAfter: 100 }; // stay ELEVATED for this test
    const due = (state: RiskState) => resourcesDue(state, noSettle);
    let s = run([{ ideation: 0.9 }], initialRisk(), noSettle);
    expect(due(s)).toBe(true); // new signal
    s = resourcesGiven(s);
    s = run([{}], s, noSettle);
    expect(due(s)).toBe(true); // one turn after the signal: still recent
    s = resourcesGiven(s);
    s = run([{}, {}], s, noSettle);
    expect(due(s)).toBe(false); // calm, and given recently
    s = run([{}], s, noSettle);
    expect(due(s)).toBe(true); // periodic check-in
  });

  it("are never due below ELEVATED", () => {
    expect(resourcesDue(run([{ ideation: 0.2 }]))).toBe(false);
  });
});

describe("ledger (part 1)", () => {
  it("keeps messages that raised concern, capped, and knows which left the window", () => {
    const s = run([{ ideation: 0.2 }, {}, {}, {}, {}, {}]);
    expect(s.ledger).toEqual([{ turn: 1, text: "message 1", level: "WATCH" }]);
    expect(ledgerOutsideWindow(s, 8)).toHaveLength(1); // 6 user turns in, turn 1 is outside the last 4
    expect(ledgerOutsideWindow(run([{ ideation: 0.2 }, {}, {}]), 8)).toHaveLength(0);
  });

  it("numbers entries by user turn, so trimming the transcript doesn't stall them", () => {
    const s = run([{}, {}, { ideation: 0.2 }]);
    expect(s.ledger[0]?.turn).toBe(3);
    const many = run(Array(30).fill({ ideation: 0.2 }));
    expect(many.ledger).toHaveLength(DEFAULT_RISK_CONFIG.ledgerMax);
  });

  it("shows Jev the early message once it has scrolled out of the window", async () => {
    const states: string[] = [];
    const client: JevClient = {
      async ask<K extends string>(state: string, questions: Record<K, unknown>, _o?: AskOptions) {
        states.push(state);
        const first = states.length === 1 && "ideation" in questions;
        const answer = (k: string) => (first && (k === "ideation" || k === "latest_adds_risk") ? 0.2 : 0);
        return Object.fromEntries(Object.keys(questions).map((k) => [k, answer(k)])) as never;
      },
    };
    const guard = new FirstRead({ client });
    const conv = new Conversation();
    await guard.checkUser(conv, "there's a thought that keeps coming back");
    conv.add("user", "there's a thought that keeps coming back");
    conv.add("assistant", "I'm here.");
    for (let i = 0; i < 5; i++) {
      await guard.checkUser(conv, `ordinary ${i}`);
      conv.add("user", `ordinary ${i}`);
      conv.add("assistant", "ok");
    }
    const last = states.at(-1)!;
    expect(last).toContain("EARLIER IN THIS CONVERSATION");
    expect(last).toContain("there's a thought that keeps coming back");
    // Not repeated while it's still inside the window.
    expect(states[1]).not.toContain("EARLIER IN THIS CONVERSATION");
  });
});

describe("rechecks", () => {
  it("apply the same CRISIS context rule as a live turn", async () => {
    // A failed turn, rechecked later, with a noisy plan-and-means reading and no self-harm context.
    const noisy = { ...QUIET, plan: 0.5, means: 0.7, imminent: 0.51, latest_adds_risk: 0.7 };
    const client: JevClient = { async ask(_s, q) { return Object.fromEntries(Object.keys(q).map((k) => [k, (noisy as Record<string, number>)[k] ?? 0])) as never; } };
    const guard = new FirstRead({ client });
    const conv = new Conversation();
    conv.add("user", "launch my pc out the window");
    conv.add("assistant", "ha");
    const r = await guard.recheck(conv, 0);
    expect(r.level).toBe("ELEVATED");
  });
});

describe("changes", () => {
  it("record every level change with its turn and reason", () => {
    const s = run([{}, { ideation: 0.2 }, { ideation: 0.9 }, { intent: 0.9 }]);
    expect(s.changes.map((c) => `${c.turn}:${c.from}->${c.to}`)).toEqual(["2:NONE->WATCH", "3:WATCH->ELEVATED", "4:ELEVATED->CRISIS"]);
    expect(s.history.map((h) => h.level)).toEqual(["NONE", "WATCH", "ELEVATED", "CRISIS"]);
    expect(s.version).toBe(4);
  });
});
