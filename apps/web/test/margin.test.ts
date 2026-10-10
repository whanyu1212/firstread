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
