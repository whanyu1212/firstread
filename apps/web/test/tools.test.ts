import { describe, expect, it } from "vitest";
import { MAX_NOTES, type Session, memorySessionStore } from "@/lib/session";
import { companionTools } from "@/lib/tools";

const newSession = (): Session => ({ notes: [], handoffs: [] });
// Tools are called the way the agent calls them; the options aren't used by these tools.
async function call<I, O>(
  t: { execute?: (input: I, options: never) => O | PromiseLike<O> | AsyncIterable<O> },
  input: I,
): Promise<O> {
  const out = await t.execute!(input, {} as never);
  if (out !== null && typeof out === "object" && Symbol.asyncIterator in out) throw new Error("streaming tool");
  return out as O;
}

describe("get_support_resources", () => {
  it("returns Singapore's verified lines, not numbers from anywhere else", async () => {
    const out = await call(companionTools(newSession()).get_support_resources, { country: "Singapore" });
    expect(out.country).toBe("Singapore");
    expect(out.emergency).toBe("995 or 999");
    expect(JSON.stringify(out.lines)).toContain("1767");
    expect(JSON.stringify(out.lines)).not.toContain("988");
  });

  it("falls back to findahelpline.com elsewhere", async () => {
    const out = await call(companionTools(newSession()).get_support_resources, { country: "Japan" });
    expect(JSON.stringify(out.lines)).toContain("findahelpline.com");
  });
});

describe("request_human_handoff", () => {
  it("records the request and never claims a person is coming", async () => {
    const session = newSession();
    const out = await call(companionTools(session).request_human_handoff, { reason: "asked for a person" });
    expect(session.handoffs).toHaveLength(1);
    expect(out.status).toBe("unavailable");
    expect(out.message).toMatch(/no person can join/);
  });
});

describe("notes", () => {
  it("saves and recalls within a session", async () => {
    const session = newSession();
    const tools = companionTools(session);
    await call(tools.save_note, { kind: "coping", text: "cold water on the wrists helps" });
    const out = await call(tools.recall_notes, {});
    expect(out.notes).toEqual([{ kind: "coping", text: "cold water on the wrists helps" }]);
  });

  it("stops saving at the limit", async () => {
    const session = newSession();
    const tools = companionTools(session);
    for (let i = 0; i < MAX_NOTES; i++) await call(tools.save_note, { kind: "other", text: `note ${i}` });
    const out = await call(tools.save_note, { kind: "other", text: "one too many" });
    expect(out.saved).toBe(false);
    expect(session.notes).toHaveLength(MAX_NOTES);
  });
});

describe("suggest_exercise", () => {
  it("returns the steps for the requested exercise", async () => {
    const out = await call(companionTools(newSession()).suggest_exercise, { kind: "box_breathing" });
    expect(out.name).toBe("Box breathing");
    expect(out.steps.length).toBeGreaterThan(0);
  });
});

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

  it("forgets sessions after the TTL", async () => {
    const store = memorySessionStore({ ttlMs: -1 });
    await store.save("a", { notes: [{ kind: "other", text: "x", at: "" }], handoffs: [] });
    expect((await store.get("a")).notes).toHaveLength(0);
  });

  it("drops the oldest sessions past the cap", async () => {
    const store = memorySessionStore({ maxSessions: 2 });
    const one = { notes: [{ kind: "other" as const, text: "x", at: "" }], handoffs: [] };
    await store.save("a", one);
    await store.save("b", one);
    await store.save("c", one);
    expect((await store.get("a")).notes).toHaveLength(0);
    expect((await store.get("c")).notes).toHaveLength(1);
  });
});
