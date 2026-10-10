import { describe, expect, it } from "vitest";
import {
  IMMINENT_CRISIS,
  IMMINENT_ELEVATED,
  INTENT_CRISIS,
  INTENT_ELEVATED,
  assessLevel,
  decideAction,
  escalate,
  levelEvidence,
  noisyOr,
} from "../src/policy";
import type { ReplySignals, UserSignals } from "../src/questions";

const QUIET_USER: UserSignals = {
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
const GOOD_REPLY: ReplySignals = {
  enables_harm: 0,
  dismisses_risk: 0,
  offers_support_resources: 0.9,
  clinical_overreach: 0,
};

const user = (p: Partial<UserSignals> = {}): UserSignals => ({ ...QUIET_USER, ...p });
const reply = (p: Partial<ReplySignals> = {}): ReplySignals => ({ ...GOOD_REPLY, ...p });

describe("assessLevel", () => {
  it("quiet turn is NONE", () => expect(assessLevel(user())).toBe("NONE"));
  it("low ideation is WATCH", () => expect(assessLevel(user({ ideation: 0.2 }))).toBe("WATCH"));
  it("plan is ELEVATED", () => expect(assessLevel(user({ plan: 0.25 }))).toBe("ELEVATED"));
  it("intent is CRISIS", () => expect(assessLevel(user({ intent: INTENT_CRISIS }))).toBe("CRISIS"));
  it("imminence is CRISIS", () => expect(assessLevel(user({ imminent: IMMINENT_CRISIS }))).toBe("CRISIS"));
  it("intent or imminence below the CRISIS cutoff is still ELEVATED", () => {
    expect(assessLevel(user({ intent: INTENT_ELEVATED }))).toBe("ELEVATED");
    expect(assessLevel(user({ intent: INTENT_CRISIS - 0.01 }))).toBe("ELEVATED");
    expect(assessLevel(user({ imminent: IMMINENT_ELEVATED }))).toBe("ELEVATED");
    expect(assessLevel(user({ imminent: IMMINENT_CRISIS - 0.01 }))).toBe("ELEVATED");
  });
  it("strong ideation with faint intent and imminence is ELEVATED, not CRISIS", () =>
    // What Jev gives "i've been thinking about killing myself": no plan, no timing.
    expect(assessLevel(user({ ideation: 0.98, intent: 0.31, imminent: 0.28 }))).toBe("ELEVATED"));
  it("method seeking is ELEVATED", () =>
    expect(assessLevel(user({ method_seeking: 0.5 }))).toBe("ELEVATED"));
  it("preparation is CRISIS", () => expect(assessLevel(user({ preparation: 0.5 }))).toBe("CRISIS"));
  it("plan plus means is CRISIS", () =>
    expect(assessLevel(user({ plan: 0.4, means: 0.4 }))).toBe("CRISIS"));
});

describe("noisyOr", () => {
  it("is 0 with no signals", () => expect(noisyOr(user())).toBe(0));
  it("adds up weak signals", () =>
    expect(noisyOr(user({ ideation: 0.25, self_harm: 0.15, plan: 0.1 }))).toBeCloseTo(1 - 0.75 * 0.85 * 0.9));
  it("ignores follow-ups and harm to others", () =>
    expect(noisyOr(user({ counselor_concern: 0.9, harm_to_others: 0.9 }))).toBe(0));
});

describe("follow-up questions", () => {
  // Borderline: noisy-OR about 0.35, but no single signal reaches ELEVATED.
  const borderline = { ideation: 0.25, self_harm: 0.14 };

  it("raise a borderline turn when one confirms", () =>
    expect(assessLevel(user({ ...borderline, disguised_request: 0.6 }))).toBe("ELEVATED"));
  it("leave a borderline turn alone when none confirms", () =>
    expect(assessLevel(user({ ...borderline, counselor_concern: 0.3 }))).toBe("WATCH"));
  it("don't act on a turn with no real signals", () =>
    expect(assessLevel(user({ ideation: 0.05, counselor_concern: 0.9 }))).toBe("NONE"));
  it("only watch on counselor concern", () => {
    // Borderline (noisy-OR about 0.23) with no single signal at WATCH.
    const faint = { ideation: 0.1, self_harm: 0.1, plan: 0.05 };
    expect(assessLevel(user({ ...faint, counselor_concern: 0.9 }))).toBe("WATCH");
    expect(assessLevel(user(faint))).toBe("NONE");
  });
  it("never lower a clear signal", () =>
    expect(assessLevel(user({ intent: 0.5, counselor_concern: 0 }))).toBe("CRISIS"));
});

describe("escalate", () => {
  it("never drops", () => expect(escalate("ELEVATED", "NONE")).toBe("ELEVATED"));
  it("goes up", () => expect(escalate("WATCH", "CRISIS")).toBe("CRISIS"));
});

describe("decideAction", () => {
  it("crisis always escalates, even with a good reply", () =>
    expect(decideAction("CRISIS", reply())).toBe("escalate"));
  it("harmful reply blocked at any level", () =>
    expect(decideAction("NONE", reply({ enables_harm: 0.2 }))).toBe("replace"));
  it("elevated reply without resources blocked", () =>
    expect(decideAction("ELEVATED", reply({ offers_support_resources: 0.1 }))).toBe("replace"));
  it("dismissive reply blocked when watching", () =>
    expect(decideAction("WATCH", reply({ dismisses_risk: 0.6 }))).toBe("replace"));
  it("normal reply sent", () =>
    expect(decideAction("NONE", reply({ offers_support_resources: 0 }))).toBe("send"));
});

describe("levelEvidence", () => {
  // assessLevel before it was built on levelEvidence, kept as the oracle.
  function oracle(p: UserSignals): string {
    if (p.intent >= 0.35 || p.imminent >= 0.4 || p.preparation >= 0.4 || (p.plan >= 0.3 && p.means >= 0.3)) return "CRISIS";
    if (p.intent >= 0.2 || p.imminent >= 0.2 || p.plan >= 0.2 || p.self_harm >= 0.3 || p.method_seeking >= 0.4 || p.ideation >= 0.4 || p.harm_to_others >= 0.4) return "ELEVATED";
    if (noisyOr(p) >= 0.2 && (p.own_death_wish >= 0.5 || p.disguised_request >= 0.5)) return "ELEVATED";
    if (p.ideation >= 0.15 || p.self_harm >= 0.15 || p.harm_to_others >= 0.2) return "WATCH";
    if (noisyOr(p) >= 0.2 && p.counselor_concern >= 0.5) return "WATCH";
    return "NONE";
  }
  let seed = 7;
  const random = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  // Mostly small answers, as real ones are, so every rule is reached.
  const sample = (): UserSignals =>
    Object.fromEntries(Object.keys(QUIET_USER).map((k) => [k, random() < 0.7 ? random() * 0.3 : random()])) as UserSignals;

  it("reads the same level as before, with answers that meet their cutoffs", () => {
    for (let i = 0; i < 20000; i++) {
      const p = sample();
      const { level, answers } = levelEvidence(p);
      expect(level).toBe(oracle(p));
      expect(assessLevel(p)).toBe(level);
      expect(answers.length > 0).toBe(level !== "NONE");
      for (const a of answers) expect(a.value).toBeGreaterThanOrEqual(a.cutoff);
      expect(answers.map((a) => a.value)).toEqual([...answers.map((a) => a.value)].sort((x, y) => y - x));
    }
  });

  it("names the answers behind a CRISIS reading", () => {
    expect(levelEvidence(user({ imminent: 0.9, ideation: 0.95 })).answers.map((a) => a.signal)).toEqual(["imminent"]);
    expect(levelEvidence(user({ plan: 0.4, means: 0.35 })).answers.map((a) => a.signal)).toEqual(["plan", "means"]);
  });

  it("names the follow-up, with the weak answers it confirmed as one combined figure", () => {
    const { level, answers, combined } = levelEvidence(user({ ideation: 0.12, self_harm: 0.1, own_death_wish: 0.7 }));
    expect(level).toBe("ELEVATED");
    expect(answers.map((a) => a.signal)).toEqual(["own_death_wish"]);
    expect(combined).toBeCloseTo(1 - 0.88 * 0.9);
  });
});
