import { FirstRead, type JevClient } from "firstread";
import { describe, expect, it } from "vitest";
import type { Draft } from "@/lib/companion";
import { DEMO_REPLIES } from "@/lib/replies";
import { type Session, emptySession } from "@/lib/session";
import { COMPANION_HISTORY_TURNS, DraftTimeoutError, STORED_TURNS, type TurnDeps, runTurn } from "@/lib/turn";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A fake Jev: fixed answers per check, optional delay or failure. Counts calls. */
class FakeJev implements JevClient {
  user: Record<string, number> = {};
  reply: Record<string, number> = { offers_support_resources: 0.9 };
  userDelayMs = 0;
  fail: "user" | "reply" | null = null;
  calls = { user: 0, reply: 0 };

  async ask<K extends string>(_state: string, questions: Record<K, unknown>) {
    const check = "ideation" in questions ? "user" : "reply";
    this.calls[check]++;
    if (check === "user" && this.userDelayMs) await sleep(this.userDelayMs);
    if (this.fail === check) throw new Error("jev down");
    const answers = check === "user" ? this.user : this.reply;
    return Object.fromEntries(Object.keys(questions).map((k) => [k, answers[k] ?? 0])) as Record<K, number>;
  }
}

/** A fake companion: answers after `delayMs`, honouring the abort signal like the real one. */
function fakeCompanion(draft: Draft, { delayMs = 0, error }: { delayMs?: number; error?: Error } = {}) {
  const seen = { calls: 0, aborted: false };
  const fn: TurnDeps["draft"] = ({ signal }) => {
    seen.calls++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => (error ? reject(error) : resolve(draft)), delayMs);
      signal.addEventListener("abort", () => {
        seen.aborted = true;
        clearTimeout(timer);
        reject(new Error("aborted"));
      });
    });
  };
  return { fn, seen };
}

function setup(draft: Draft = { reply: "That sounds hard. Want to tell me more?", exercise: null }, opts = {}) {
  const jev = new FakeJev();
  const guard = new FirstRead({ client: jev, replies: DEMO_REPLIES });
  const companion = fakeCompanion(draft, opts);
  const session: Session = emptySession();
  return { jev, guard, companion, session, deps: { guard, draft: companion.fn } };
}

describe("runTurn", () => {
  it("sends the companion's reply on an ordinary turn, with its exercise", async () => {
    const { deps, session } = setup({ reply: "Let's try a breath together.", exercise: "box_breathing" });
    const r = await runTurn("feeling a bit panicky", session, deps);
    expect(r.audit.action).toBe("send");
    expect(r.audit.reply).toBe("Let's try a breath together.");
    expect(r.exercise?.id).toBe("box_breathing");
    expect(r.shortCircuit).toBeNull();
    expect(session.conv.turns).toHaveLength(2);
  });

  it("stops the companion when the user check says CRISIS, and answers before it would have", async () => {
    const { deps, session, jev, companion } = setup(undefined, { delayMs: 2000 });
    jev.user = { intent: 0.9, ideation: 0.9 };
    const started = Date.now();
    const r = await runTurn("i've decided, it's tonight", session, deps);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(companion.seen.aborted).toBe(true);
    expect(r.shortCircuit).toBe("crisis");
    expect(r.audit).toMatchObject({ action: "escalate", level: "CRISIS", reply: DEMO_REPLIES.crisis });
    expect(r.handoff?.reason).toMatch(/CRISIS/);
    expect(jev.calls.reply).toBe(0);
    expect(session.conv.risk.level).toBe("CRISIS");
  });

  it("escalates even if CRISIS arrives after the draft is done", async () => {
    const { deps, session, jev } = setup();
    jev.user = { intent: 0.9, ideation: 0.9 };
    jev.userDelayMs = 50; // the companion (0ms) finishes first
    const r = await runTurn("i've decided", session, deps);
    expect(r.audit.action).toBe("escalate");
    expect(r.audit.reply).toBe(DEMO_REPLIES.crisis);
  });

  it("answers at once with no checks and no companion when already at CRISIS", async () => {
    const { deps, session, jev, companion } = setup();
    session.conv.risk = { ...session.conv.risk, level: "CRISIS", peak: "CRISIS" };
    const r = await runTurn("thanks", session, deps);
    expect(r.shortCircuit).toBe("already-crisis");
    expect(r.audit.reply).toBe(DEMO_REPLIES.crisis);
    expect(jev.calls).toEqual({ user: 0, reply: 0 });
    expect(companion.seen.calls).toBe(0);
    expect(r.handoff).toBeNull(); // recorded when the conversation first reached CRISIS
  });

  it("fails closed when Jev is down: no draft goes out, and no exercise", async () => {
    const { deps, session, jev } = setup({ reply: "unchecked draft", exercise: "box_breathing" });
    jev.fail = "reply";
    const r = await runTurn("hi", session, deps);
    expect(r.audit.reply).not.toBe("unchecked draft");
    expect(r.audit.reply).toBe(DEMO_REPLIES.holding);
    expect(r.exercise).toBeNull();
  });

  it("drops the exercise when FirstRead replaces the reply", async () => {
    const { deps, session, jev } = setup({ reply: "a reply", exercise: "box_breathing" });
    jev.user = { ideation: 0.9 }; // ELEVATED
    jev.reply = { offers_support_resources: 0.1 }; // no lines: replaced
    const r = await runTurn("i don't want to be here", session, deps);
    expect(r.audit.action).toBe("replace");
    expect(r.audit.reply).toBe(DEMO_REPLIES.safe);
    expect(r.exercise).toBeNull();
  });

  it("records a handoff when the person asks for a real person", async () => {
    const { deps, session, jev } = setup();
    jev.user = { asks_for_person: 0.9 };
    const r = await runTurn("can a real person talk to me?", session, deps);
    expect(r.handoff?.reason).toMatch(/real person/);
    expect(session.handoffs).toHaveLength(1);
  });

  it("routes a companion failure through FirstRead instead of sending nothing", async () => {
    const { deps, session, jev } = setup(undefined, { error: new Error("openai down") });
    jev.user = { ideation: 0.9 }; // ELEVATED: the fallback is the safe reply with the lines
    const r = await runTurn("i don't want to be here", session, deps);
    expect(r.draftError).toBeInstanceOf(Error);
    expect(r.audit.reply).toBe(DEMO_REPLIES.safe);
    expect(r.audit.reply).toContain("1767");
    expect(session.conv.risk.level).toBe("ELEVATED");
  });

  it("stops a companion that takes too long and sends FirstRead's fallback", async () => {
    const { session, guard, companion } = setup(undefined, { delayMs: 5000 });
    const started = Date.now();
    const r = await runTurn("hi", session, { guard, draft: companion.fn, draftTimeoutMs: 100 });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(companion.seen.aborted).toBe(true);
    expect(r.draftError).toBeInstanceOf(DraftTimeoutError);
    expect(r.shortCircuit).toBeNull();
    expect(r.audit.reply).toBe(DEMO_REPLIES.holding);
  });

  it("gives the companion the history the user actually saw", async () => {
    const { session, guard, jev } = setup();
    jev.user = { ideation: 0.9 };
    jev.reply = { offers_support_resources: 0.1 };
    const first = fakeCompanion({ reply: "draft one", exercise: null });
    await runTurn("i don't want to be here", session, { guard, draft: first.fn });
    let seen: unknown;
    await runTurn("ok", session, {
      guard,
      draft: async (input) => {
        seen = input.history;
        return { reply: "ok", exercise: null };
      },
    });
    // The first reply was replaced, so the companion sees the replacement, not its own draft.
    expect(seen).toEqual([
      { role: "user", text: "i don't want to be here" },
      { role: "assistant", text: DEMO_REPLIES.safe },
    ]);
  });
});

describe("history limits", () => {
  it("gives the companion only recent turns, and caps what the session keeps", async () => {
    const { session, guard } = setup();
    session.conv.turns = Array.from({ length: 150 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `t${i}` }) as const);
    let seen = 0;
    await runTurn("hi", session, {
      guard,
      draft: async (input) => {
        seen = input.history.length;
        return { reply: "ok", exercise: null };
      },
    });
    expect(seen).toBe(COMPANION_HISTORY_TURNS);
    expect(session.conv.turns).toHaveLength(STORED_TURNS);
    expect(session.conv.turns.at(-1)?.text).toBe("ok");
  });
});

describe("DEMO_REPLIES", () => {
  it("never promises a person, and gives Singapore's lines", () => {
    for (const reply of [DEMO_REPLIES.crisis, DEMO_REPLIES.safe]) {
      expect(reply).not.toMatch(/person from our team/i);
      expect(reply).toContain("1767");
      expect(reply).not.toContain("988");
    }
  });
});
