import { Conversation } from "firstread";
import { describe, expect, it } from "vitest";
import { emptySession, fromConversation, memorySessionStore, toConversation } from "@/lib/session";
import { EXERCISES, exerciseIndex } from "@/lib/skills/exercises";
import { supportLinesSkill } from "@/lib/skills/support-lines";

describe("memorySessionStore", () => {
  it("keeps sessions apart and returns copies", async () => {
    const store = memorySessionStore();
    const a = await store.get("a");
    a.notes.push({ kind: "other", text: "x", at: "" });
    expect((await store.get("a")).notes).toHaveLength(0); // not saved yet
    await store.save("a", a);
    expect((await store.get("a")).notes).toHaveLength(1);
    expect((await store.get("b")).notes).toHaveLength(0);
  });

  it("never lowers the stored risk level with a stale write", async () => {
    const store = memorySessionStore();
    const stale = await store.get("a");
    const fresh = await store.get("a");
    fresh.conv.level = "CRISIS";
    await store.save("a", fresh);
    await store.save("a", stale); // e.g. a late background write from before the escalation
    expect((await store.get("a")).conv.level).toBe("CRISIS");
  });

  it("update() changes the latest copy, not a stale one", async () => {
    const store = memorySessionStore();
    const s = emptySession();
    s.conv.turns.push({ role: "user", text: "hi" });
    await store.save("a", s);
    await store.update("a", (latest) => latest.notes.push({ kind: "coping", text: "walks", at: "" }));
    const got = await store.get("a");
    expect(got.conv.turns).toHaveLength(1);
    expect(got.notes).toHaveLength(1);
  });

  it("forgets sessions after the TTL and drops the oldest past the cap", async () => {
    const expired = memorySessionStore({ ttlMs: -1 });
    await expired.update("a", (s) => s.notes.push({ kind: "other", text: "x", at: "" }));
    expect((await expired.get("a")).notes).toHaveLength(0);

    const capped = memorySessionStore({ maxSessions: 2 });
    for (const id of ["a", "b", "c"]) await capped.update(id, (s) => s.notes.push({ kind: "other", text: id, at: "" }));
    expect((await capped.get("a")).notes).toHaveLength(0);
    expect((await capped.get("c")).notes).toHaveLength(1);
  });

  it("round-trips a Conversation through plain data", () => {
    const conv = new Conversation();
    conv.add("user", "hi");
    conv.level = "WATCH";
    const back = toConversation(structuredClone(fromConversation(conv)));
    expect(back).toBeInstanceOf(Conversation);
    expect(back.level).toBe("WATCH");
    back.add("assistant", "hello"); // methods survive
    expect(back.turns).toHaveLength(2);
  });
});

describe("skills", () => {
  it("the exercise index lists ids and when to use them, never the steps", () => {
    const index = exerciseIndex();
    for (const e of Object.values(EXERCISES)) {
      expect(index).toContain(e.id);
      for (const step of e.steps) expect(index).not.toContain(step);
    }
  });

  it("the support lines are Singapore's verified ones", () => {
    const text = supportLinesSkill();
    for (const s of ["1767", "9151 1767", "1771", "+65 6669 1771", "995 or 999"]) expect(text).toContain(s);
  });
});
