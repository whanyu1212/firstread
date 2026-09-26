/** Eval pacer: every HTTP attempt, retries included, stays under the requests/minute limit. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { Pacer, parseRpm } from "../evals/pacing";

// 600 rpm = one slot every 100ms: fast enough for tests, and a wide gap between "waited" and
// "didn't wait" even on a slow CI machine.
const RPM = 600;
const INTERVAL = 100;

function stubFetch() {
  const starts: number[] = [];
  vi.stubGlobal("fetch", async () => {
    starts.push(performance.now());
    return new Response("{}");
  });
  return starts;
}

afterEach(() => vi.unstubAllGlobals());

describe("Pacer", () => {
  it("spaces every attempt, so SDK retries count against the limit", async () => {
    const starts = stubFetch();
    const pacer = new Pacer(RPM);
    // A logical call plus two retries is three requests.
    for (let i = 0; i < 3; i++) await pacer.fetch("https://example.test");
    expect(starts).toHaveLength(3);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(INTERVAL - 5);
    }
  });

  it("uses a reserved slot once, then makes the retry wait for its own", async () => {
    const starts = stubFetch();
    const pacer = new Pacer(RPM);
    await pacer.reserve();
    const t0 = performance.now();
    await pacer.fetch("https://example.test"); // uses the reserved slot: no wait
    expect(starts[0]! - t0).toBeLessThan(INTERVAL / 2);
    await pacer.fetch("https://example.test"); // a retry: waits for the next slot
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(INTERVAL - 5);
  });

  it("doesn't wait without a limit", async () => {
    const starts = stubFetch();
    const pacer = new Pacer();
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) await pacer.fetch("https://example.test");
    expect(starts.at(-1)! - t0).toBeLessThan(INTERVAL);
  });
});

describe("parseRpm", () => {
  it("accepts a positive number or nothing", () => {
    expect(parseRpm("25")).toBe(25);
    expect(parseRpm(undefined)).toBeUndefined();
  });

  it("rejects values that would silently disable pacing", () => {
    for (const bad of ["0", "-5", "abc", "Infinity"]) expect(() => parseRpm(bad)).toThrow(/--rpm/);
  });
});
