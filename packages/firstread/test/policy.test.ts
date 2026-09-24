import { describe, expect, it } from "vitest";
import { assessLevel, decideAction, escalate } from "../src/policy";
import type { ReplySignals, UserSignals } from "../src/questions";

const QUIET_USER: UserSignals = {
  ideation: 0,
  self_harm: 0,
  plan: 0,
  means: 0,
  intent: 0,
  imminent: 0,
  harm_to_others: 0,
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
  it("intent is CRISIS", () => expect(assessLevel(user({ intent: 0.3 }))).toBe("CRISIS"));
  it("plan plus means is CRISIS", () =>
    expect(assessLevel(user({ plan: 0.4, means: 0.4 }))).toBe("CRISIS"));
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
