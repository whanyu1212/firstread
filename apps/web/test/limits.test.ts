import { describe, expect, it } from "vitest";
import { type CounterStore, LIMITS, chatCapRefusal, rateRefusal } from "@/lib/limits";

function counters(): CounterStore {
  const counts = new Map<string, number>();
  return {
    async incr(key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key)!;
    },
    async expire() {
      return 1;
    },
  };
}

const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);

describe("chatCapRefusal", () => {
  it("caps a conversation on our key, not on the visitor's", () => {
    expect(chatCapRefusal(LIMITS.turnsPerChat - 1, true)).toBeNull();
    expect(chatCapRefusal(LIMITS.turnsPerChat, true)).toMatch(/reached its 30 messages/);
    expect(chatCapRefusal(LIMITS.turnsPerChat, false)).toBeNull();
  });
});

describe("rateRefusal", () => {
  it("limits turns per minute per IP, on any key, and resets the next minute", async () => {
    const store = counters();
    const ask = (now: number, ip = "1") => rateRefusal({ store, ip, ourKey: false, now });
    for (let i = 0; i < LIMITS.perMinute; i++) expect(await ask(NOW)).toBeNull();
    expect(await ask(NOW)).toMatch(/a lot of messages in a minute/);
    expect(await ask(NOW, "2")).toBeNull(); // another visitor
    expect(await ask(NOW + 60_000)).toBeNull();
  });

  it("limits turns per day per IP on our key only", async () => {
    const store = counters();
    let refusal: string | null = null;
    for (let i = 0; i <= LIMITS.perDay && !refusal; i++) {
      // A new minute each time, so only the day's count adds up.
      refusal = await rateRefusal({ store, ip: "1", ourKey: true, now: NOW + i * 60_000 });
    }
    expect(refusal).toMatch(/today's 60 live messages/);
    expect(await rateRefusal({ store, ip: "1", ourKey: false, now: NOW + 3_600_000 })).toBeNull();
  });
});
