import { Conversation } from "firstread";
import { describe, expect, it } from "vitest";
import { type RedisLike, type SessionStore, emptySession, fromConversation, memorySessionStore, redisSessionStore, toConversation } from "@/lib/session";
import { EXERCISES, exerciseIndex } from "@/lib/skills/exercises";
import { supportLinesSkill } from "@/lib/skills/support-lines";

/** Upstash, in memory: values go through JSON as they do over REST, and keys expire. */
function fakeRedis(): RedisLike {
  const data = new Map<string, { value: string; until: number }>();
  const live = (key: string) => {
    const entry = data.get(key);
    if (entry && entry.until <= Date.now()) data.delete(key);
    return data.get(key);
  };
  return {
    async get<T>(key: string) {
      const entry = live(key);
      return entry ? (JSON.parse(entry.value) as T) : null;
    },
    async set(key, value, opts) {
      if ("nx" in opts && live(key)) return null;
      const ms = "ex" in opts ? opts.ex * 1000 : opts.px;
      data.set(key, { value: JSON.stringify(value), until: Date.now() + ms });
      return "OK";
    },
    // The store's one script: delete the lock if it still holds this token.
    async eval<A extends unknown[], R>(_script: string, keys: string[], args: A) {
      const entry = live(keys[0]!);
      if (entry && JSON.parse(entry.value) === args[0]) data.delete(keys[0]!);
      return 1 as R;
    },
  };
}

const STORES: [string, () => SessionStore][] = [
  ["memorySessionStore", () => memorySessionStore()],
  ["redisSessionStore", () => redisSessionStore(fakeRedis(), { pollMs: 2 })],
];

describe.each(STORES)("%s", (_name, makeStore) => {
  it("keeps sessions apart and returns copies", async () => {
    const store = makeStore();
    const a = await store.get("a");
    a.notes.push({ kind: "other", text: "x", at: "" });
    expect((await store.get("a")).notes).toHaveLength(0); // not saved yet
    await store.save("a", a);
    expect((await store.get("a")).notes).toHaveLength(1);
    expect((await store.get("b")).notes).toHaveLength(0);
  });

  it("a stale write can't undo a newer turn's escalation", async () => {
    const store = makeStore();
    const stale = await store.get("a");
    const fresh = await store.get("a");
    fresh.conv.risk = { ...fresh.conv.risk, level: "CRISIS", version: fresh.conv.risk.version + 1 };
    await store.save("a", fresh);
    await store.save("a", stale); // e.g. a late write from before the escalation
    expect((await store.get("a")).conv.risk.level).toBe("CRISIS");
  });

  it("a newer write may lower the level (ELEVATED settling to WATCH)", async () => {
    const store = makeStore();
    const s = await store.get("a");
    s.conv.risk = { ...s.conv.risk, level: "ELEVATED", version: 1 };
    await store.save("a", s);
    s.conv.risk = { ...s.conv.risk, level: "WATCH", version: 2 };
    await store.save("a", s);
    expect((await store.get("a")).conv.risk.level).toBe("WATCH");
  });

  it("an equal-version write from the same base can't undo an escalation", async () => {
    const store = makeStore();
    const base = await store.get("a");
    const crisis = structuredClone(base);
    crisis.conv.risk = { ...crisis.conv.risk, level: "CRISIS", version: 2 };
    const elevated = structuredClone(base);
    elevated.conv.risk = { ...elevated.conv.risk, level: "ELEVATED", version: 2 };
    await store.save("a", crisis);
    await store.save("a", elevated); // saved last, same version
    expect((await store.get("a")).conv.risk.level).toBe("CRISIS");
  });

  it("lock() runs a chat's turns one at a time, and other chats in parallel", async () => {
    const store = makeStore();
    const order: string[] = [];
    const slow = (tag: string, ms: number) => async () => {
      order.push(`${tag} start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${tag} end`);
      return tag;
    };
    const [a1, a2, b1] = await Promise.all([store.lock("a", slow("a1", 30)), store.lock("a", slow("a2", 1)), store.lock("b", slow("b1", 1))]);
    expect([a1, a2, b1]).toEqual(["a1", "a2", "b1"]);
    expect(order.indexOf("a2 start")).toBeGreaterThan(order.indexOf("a1 end"));
    expect(order.indexOf("b1 end")).toBeLessThan(order.indexOf("a1 end"));
  });

  it("lock() keeps going after a failed turn", async () => {
    const store = makeStore();
    await expect(store.lock("a", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(store.lock("a", async () => "ok")).resolves.toBe("ok");
  });

  it("keeps notes added after a snapshot was read", async () => {
    const store = makeStore();
    const snapshot = await store.get("a"); // the next turn reads its session
    await store.update("a", (s) => s.notes.push({ kind: "coping", text: "walks help", at: "" })); // background note
    snapshot.conv.turns.push({ role: "user", text: "hi" });
    await store.save("a", snapshot); // the turn saves its stale copy
    const got = await store.get("a");
    expect(got.notes.map((n) => n.text)).toEqual(["walks help"]);
    expect(got.conv.turns).toHaveLength(1);
  });

  it("update() changes the latest copy, not a stale one", async () => {
    const store = makeStore();
    const s = emptySession();
    s.conv.turns.push({ role: "user", text: "hi" });
    await store.save("a", s);
    await store.update("a", (latest) => latest.notes.push({ kind: "coping", text: "walks", at: "" }));
    const got = await store.get("a");
    expect(got.conv.turns).toHaveLength(1);
    expect(got.notes).toHaveLength(1);
  });
});

describe("memorySessionStore", () => {
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
    expect(back.risk.version).toBe(conv.risk.version);
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

describe("redisSessionStore", () => {
  it("is shared: a second instance on the same Redis sees the first one's session", async () => {
    const redis = fakeRedis();
    const one = redisSessionStore(redis);
    const s = emptySession();
    s.conv.risk = { ...s.conv.risk, level: "CRISIS", version: 3 };
    await one.save("a", s);
    expect((await redisSessionStore(redis).get("a")).conv.risk.level).toBe("CRISIS");
  });

  it("lock() holds across instances on the same Redis", async () => {
    const redis = fakeRedis();
    const order: string[] = [];
    const turn = (tag: string, ms: number) => async () => {
      order.push(`${tag} start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${tag} end`);
    };
    await Promise.all([
      redisSessionStore(redis, { pollMs: 2 }).lock("a", turn("one", 30)),
      redisSessionStore(redis, { pollMs: 2 }).lock("a", turn("two", 1)),
    ]);
    expect(order).toEqual(["one start", "one end", "two start", "two end"]);
  });

  it("forgets sessions after the TTL", async () => {
    const store = redisSessionStore(fakeRedis(), { ttlMs: -1000 });
    await store.update("a", (s) => s.notes.push({ kind: "other", text: "x", at: "" }));
    expect((await store.get("a")).notes).toHaveLength(0);
  });
});
