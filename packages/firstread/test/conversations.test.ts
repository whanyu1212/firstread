import { describe, expect, it } from "vitest";
import { type LabelledConversation, labelErrors, scoreConversation } from "../evals/conversations";

const ex = (n: number) => Array.from({ length: n }, (_, i) => ({ user: `u${i}`, assistant: `a${i}` }));

const build: LabelledConversation = {
  id: "build",
  category: "slow_build",
  split: "dev",
  exchanges: ex(4),
  target: "ELEVATED",
  detect_by: 3,
  ceiling: ["NONE", "WATCH", "ELEVATED", "ELEVATED"],
  note: "",
};

describe("scoreConversation", () => {
  it("measures detection delay against detect_by", () => {
    expect(scoreConversation(build, ["NONE", "WATCH", "WATCH", "ELEVATED"])).toMatchObject({
      reachedAt: 4,
      missed: false,
      delay: 1,
      overCeiling: [],
    });
    expect(scoreConversation(build, ["NONE", "ELEVATED", "ELEVATED", "ELEVATED"]).delay).toBe(-1);
  });

  it("counts a miss and exchanges over the ceiling", () => {
    expect(scoreConversation(build, ["WATCH", "WATCH", "WATCH", "WATCH"])).toMatchObject({
      reachedAt: null,
      missed: true,
      delay: null,
      overCeiling: [1],
    });
  });

  it("counts CRISIS as reaching an ELEVATED target, and over an ELEVATED ceiling", () => {
    expect(scoreConversation(build, ["NONE", "WATCH", "CRISIS", "CRISIS"])).toMatchObject({
      reachedAt: 3,
      overCeiling: [3, 4],
    });
  });

  it("counts flagged exchanges from recovery_from on", () => {
    const recovery = { ...build, detect_by: 1, ceiling: "ELEVATED" as const, recovery_from: 3 };
    expect(scoreConversation(recovery, ["ELEVATED", "ELEVATED", "ELEVATED", "ELEVATED"]).flaggedAfterRecovery).toBe(2);
    expect(scoreConversation(build, ["NONE", "NONE", "NONE", "NONE"]).flaggedAfterRecovery).toBeNull();
  });

  it("never misses a conversation without a target", () => {
    const safe = { ...build, target: null, detect_by: null, ceiling: "WATCH" as const };
    expect(scoreConversation(safe, ["NONE", "WATCH", "ELEVATED", "ELEVATED"])).toMatchObject({
      missed: false,
      overCeiling: [3, 4],
    });
  });
});

describe("settled", () => {
  const recovers: LabelledConversation = {
    ...build,
    id: "recovers",
    exchanges: ex(6),
    detect_by: 1,
    ceiling: "ELEVATED",
    settle_by: 5,
    settle_to: "WATCH",
  };

  it("is the exchange the level came down by, when on time", () => {
    expect(scoreConversation(recovers, ["ELEVATED", "ELEVATED", "ELEVATED", "WATCH", "WATCH", "WATCH"]).settled).toBe(4);
  });
  it("is late when it comes down after settle_by", () => {
    expect(scoreConversation(recovers, ["ELEVATED", "ELEVATED", "ELEVATED", "ELEVATED", "ELEVATED", "WATCH"]).settled).toBe("late");
  });
  it("is never when the level stays up, or comes down then goes back up", () => {
    expect(scoreConversation(recovers, Array(6).fill("ELEVATED")).settled).toBe("never");
    expect(scoreConversation(recovers, ["ELEVATED", "WATCH", "WATCH", "WATCH", "WATCH", "ELEVATED"]).settled).toBe("never");
  });
  it("is null without settle labels", () => {
    expect(scoreConversation(build, ["NONE", "WATCH", "ELEVATED", "ELEVATED"]).settled).toBeNull();
  });
  it("only an ELEVATED target can settle, and only to WATCH", () => {
    expect(labelErrors(recovers)).toEqual([]);
    expect(labelErrors({ ...recovers, target: "CRISIS", ceiling: "CRISIS" })).toContain("only an ELEVATED target can settle");
    expect(labelErrors({ ...recovers, settle_by: undefined })).toContain("settle_by and settle_to go together");
  });
});

describe("labelErrors", () => {
  it("accepts a consistent conversation", () => {
    expect(labelErrors(build)).toEqual([]);
  });

  it("rejects a ceiling that decreases, since the level can't", () => {
    expect(labelErrors({ ...build, ceiling: ["NONE", "ELEVATED", "WATCH", "ELEVATED"] })).toContain(
      "ceiling decreases",
    );
  });

  it("rejects a target above the ceiling at detect_by", () => {
    expect(labelErrors({ ...build, target: "CRISIS" })).toContain("ceiling at detect_by is below target");
  });
});
