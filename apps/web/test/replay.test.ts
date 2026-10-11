import { describe, expect, it } from "vitest";
import { RECORDINGS } from "../lib/recordings";
import { finalStep, messagesAt, replaySchedule, replyMessage, type Recording } from "../lib/replay";
import { SCENARIOS } from "../lib/scenarios";

describe("recordings", () => {
  it("has one for every scenario, with the scenario's messages in order", () => {
    for (const s of SCENARIOS) {
      const rec = RECORDINGS[s.id];
      expect(rec, `no recording for ${s.id}; run record:replay ${s.id}`).toBeDefined();
      expect(rec!.turns.map((t) => t.user), `${s.id} changed since it was recorded`).toEqual(s.messages);
      for (const t of rec!.turns) expect(t.data.timing && t.data.risk && t.data.audit).toBeTruthy();
    }
  });
});

describe("replay", () => {
  const rec = RECORDINGS[SCENARIOS[0]!.id]!;

  it("schedules each turn's message, read and reply in order", () => {
    const steps = replaySchedule(rec);
    expect(steps.map((s) => s.at)).toEqual([...steps.map((s) => s.at)].sort((a, b) => a - b));
    expect(steps.at(-1)).toMatchObject(finalStep(rec));
    expect(steps.filter((s) => s.phase === "user")).toHaveLength(rec.turns.length);
  });

  it("shows the latest turn's message alone before its reply, and keeps plays apart by id", () => {
    const first = messagesAt(rec, { turn: 1, phase: "user" }, "a-");
    expect(first.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    const again = messagesAt(rec, { turn: 1, phase: "user" }, "b-");
    expect(again.map((m) => m.id)).not.toEqual(first.map((m) => m.id));
    expect(messagesAt(rec, finalStep(rec))).toHaveLength(2 * rec.turns.length);
  });

  it("adds a recorded draft only when a synthetic turn is done", () => {
    const turn = { ...rec.turns[0]!, draft: "the companion's original words" };
    expect(replyMessage(turn, 0, "checked").parts).not.toContainEqual(
      expect.objectContaining({ type: "data-recordedDraft" }),
    );
    expect(replyMessage(turn, 0, "done").parts).toContainEqual({
      type: "data-recordedDraft",
      data: { text: "the companion's original words" },
    });
  });

  it("keeps recordings made before draft capture compatible", () => {
    const oldRecording = structuredClone(rec) as Recording;
    for (const turn of oldRecording.turns) delete turn.draft;
    const replies = messagesAt(oldRecording, finalStep(oldRecording)).filter((message) => message.role === "assistant");
    for (const reply of replies) {
      expect(reply.parts).not.toContainEqual(expect.objectContaining({ type: "data-recordedDraft" }));
    }
  });
});
