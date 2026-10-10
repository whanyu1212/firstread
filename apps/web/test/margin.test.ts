import { describe, expect, it } from "vitest";
import type { ChatData } from "@/lib/chat";
import { HANDOFF_REASON, handoffLine } from "@/lib/handoff";
import { draftChange, why } from "@/lib/margin";
import { RECORDINGS } from "@/lib/recordings";

const turns = Object.values(RECORDINGS).flatMap((r) => r.turns);

describe("turn notes", () => {
  it("only calls a handoff a request when the person asked", () => {
    expect(handoffLine(HANDOFF_REASON.request)).toMatch(/request for a person/);
    expect(handoffLine(HANDOFF_REASON.crisis)).not.toMatch(/request/);
  });

  it("never shows a probability on a calm turn, and gives every risky turn a reason", () => {
    for (const t of turns) {
      const { risk, audit } = t.data as ChatData;
      const { answers, note } = why(risk, audit, null);
      if (risk.level === "NONE") expect(answers).toEqual([]);
      expect(answers.length > 0 || Boolean(note)).toBe(true);
      expect(answers.some((a) => a.signal === "counselor_concern" && audit.userSignals && risk.level !== "WATCH")).toBe(false);
    }
  });

  it("explains every reply that wasn't sent as written, and no other", () => {
    for (const t of turns) {
      const { audit } = t.data as ChatData;
      // A turn already at CRISIS has no draft; its note says so instead.
      const changed = audit.shortCircuit !== "already-crisis" && (audit.action !== "send" || audit.failures.length > 0);
      expect(Boolean(draftChange(audit)), t.user).toBe(changed);
    }
  });
});

describe("turn note edge cases", () => {
  const quiet = Object.fromEntries(
    ["ideation", "self_harm", "method_seeking", "plan", "means", "intent", "preparation", "imminent", "harm_to_others",
     "own_death_wish", "disguised_request", "counselor_concern", "latest_adds_risk", "asks_for_person"].map((k) => [k, 0]),
  ) as unknown as NonNullable<ChatData["audit"]["userSignals"]>;
  const risk = (level: ChatData["risk"]["level"]) => ({ level }) as ChatData["risk"];
  const audit = (a: Partial<ChatData["audit"]>): ChatData["audit"] =>
    ({ level: "NONE", action: "send", failures: [], userSignals: quiet, replySignals: null, shortCircuit: null, ...a }) as ChatData["audit"];

  it("says when a higher level is kept from earlier messages", () => {
    const { answers, note } = why(risk("ELEVATED"), audit({ level: "ELEVATED", userSignals: { ...quiet, ideation: 0.2 } }), null);
    expect(answers.map((a) => a.signal)).toEqual(["ideation"]);
    expect(note).toMatch(/alone reads as WATCH.*keeps ELEVATED/);
  });

  it("says how Jev failed, not always that it was slow", () => {
    const down = audit({ userSignals: null, action: "replace", failures: [{ check: "user", reason: "error" }] });
    expect(why(risk("NONE"), down, null).note).toMatch(/returned an error/);
    expect(draftChange(down)).toMatch(/returned an error for the check on this message/);
    const slow = audit({ action: "replace", failures: [{ check: "reply", reason: "timeout" }] });
    expect(draftChange(slow)).toMatch(/didn't answer in time for the check on the draft/);
  });

  it("names both findings when clinical advice and missing support could each be the cause", () => {
    const reply = { enables_harm: 0, dismisses_risk: 0, offers_support_resources: 0.1, clinical_overreach: 0.8 };
    expect(draftChange(audit({ level: "ELEVATED", action: "replace", replySignals: reply }))).toMatch(/clinical advice \(80%\) and didn't point to support/);
    expect(draftChange(audit({ level: "ELEVATED", action: "replace", replySignals: { ...reply, clinical_overreach: 0 } }))).toMatch(/^The draft didn't point to support/);
  });
});
