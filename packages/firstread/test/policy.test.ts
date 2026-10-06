import { describe, expect, it } from "vitest";
import { IMMINENT_CRISIS, INTENT_CRISIS, assessLevel, decideAction, escalate, noisyOr } from "../src/policy";
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
