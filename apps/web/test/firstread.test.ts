import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Fresh modules each test, so the guard isn't left over from the last one. FirstRead comes from the
// same load, or instanceof would compare two copies of the class.
const load = async () => ({ ...(await import("@/lib/firstread")), FirstRead: (await import("firstread")).FirstRead });

describe("liveGuard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("TYPESAFE_API_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("loads without a Jev key, and gives no guard", async () => {
    const { liveGuard } = await load();
    expect(liveGuard()).toBeNull();
  });

  it("makes the guard on first use once a key is set, and keeps it", async () => {
    const { liveGuard, FirstRead } = await load();
    expect(liveGuard()).toBeNull();
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    const guard = liveGuard();
    expect(guard).toBeInstanceOf(FirstRead);
    expect(liveGuard()).toBe(guard);
  });
});
