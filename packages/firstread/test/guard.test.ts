/** Guard wiring tests with a fake Jev client (no API key needed). */

import { APIConnectionError, APIError, APITimeoutError, APIUserAbortError } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { Conversation, FirstRead } from "../src/guard";
import { type AskOptions, GATEWAY_BASE_URL, type JevClient, clientConfig, failureReason } from "../src/jev";
import { CRISIS_REPLY, HOLDING_REPLY, SAFE_REPLY } from "../src/templates";

type Check = "user" | "reply";
type Behaviour = { delayMs?: number; hang?: boolean; error?: Error };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Answers every question with a fixed probability, overridable per key. */
class FakeClient implements JevClient {
  overrides: Record<string, number> = {};
  states: string[] = [];
  calls: { check: Check; options?: AskOptions }[] = [];
  /** Per check: answer after a delay, never answer, or throw. Default: answer at once. */
  behaviour: Partial<Record<Check, Behaviour>> = {};

  async ask<K extends string>(state: string, questions: Record<K, unknown>, options?: AskOptions) {
    const check: Check = "ideation" in questions ? "user" : "reply";
    this.states.push(state);
    this.calls.push({ check, options });
    const { delayMs, hang, error } = this.behaviour[check] ?? {};
    if (hang) await new Promise(() => {});
    if (delayMs) await sleep(delayMs);
    if (error) throw error;
    const answers = {} as Record<K, number>;
    for (const key of Object.keys(questions) as K[]) answers[key] = this.overrides[key] ?? 0;
    return answers;
  }
}

function make() {
  const client = new FakeClient();
  return { client, guard: new FirstRead({ client }) };
}

describe("FirstRead.audit", () => {
  it("sends the draft on a safe turn", async () => {
    const { guard } = make();
    const audit = await guard.audit(new Conversation(), "hi", "hello!");
    expect(audit.action).toBe("send");
    expect(audit.reply).toBe("hello!");
  });

  it("sends the crisis reply on a crisis turn", async () => {
    const { client, guard } = make();
    client.overrides.intent = 0.9;
    const audit = await guard.audit(new Conversation(), "...", "draft");
    expect(audit.action).toBe("escalate");
    expect(audit.reply).toBe(CRISIS_REPLY);
  });

  it("keeps risk sticky across turns", async () => {
    const { client, guard } = make();
    const conv = new Conversation();
    client.overrides.plan = 0.5;
    await guard.audit(conv, "first", "draft");
    client.overrides = {};
    const audit = await guard.audit(conv, "feeling better", "draft");
    expect(audit.level).toBe("ELEVATED");
    // elevated + draft with no support resources -> replaced
    expect(audit.action).toBe("replace");
  });

  it("shows Jev prior turns and the draft", async () => {
    const { client, guard } = make();
    const conv = new Conversation();
    await guard.audit(conv, "earlier message", "earlier reply");
    await guard.audit(conv, "latest message", "the draft");
    const replyState = client.states.find((s) => s.includes("the draft"));
    expect(replyState).toContain("earlier message");
    expect(replyState).toContain("latest message");
  });

  it("only shows Jev the last `window` turns", async () => {
    const client = new FakeClient();
    const guard = new FirstRead({ client, window: 2 });
    const conv = new Conversation();
    conv.add("user", "oldest");
    conv.add("assistant", "old reply");
    conv.add("user", "recent");
    conv.add("assistant", "recent reply");
    await guard.checkUser(conv, "now");
    expect(client.states[0]).not.toContain("oldest");
    expect(client.states[0]).toContain("recent");
  });
});

describe("FirstRead.startTurn", () => {
  it("starts the user check before the draft exists", async () => {
    const { client, guard } = make();
    const pending = guard.startTurn(new Conversation(), "hi");
    expect(client.calls.map((c) => c.check)).toEqual(["user"]);
    await pending.finish("hello!");
    expect(client.calls.map((c) => c.check)).toEqual(["user", "reply"]);
  });

  it("starts the deadline when the draft is ready, not when the turn starts", async () => {
    const client = new FakeClient();
    client.behaviour.user = { delayMs: 60 };
    const guard = new FirstRead({ client, deadlineMs: 40 });
    const pending = guard.startTurn(new Conversation(), "hi");
    await sleep(50); // a slow companion: the user check is still running
    const audit = await pending.finish("hello!");
    expect(audit.failures).toEqual([]);
    expect(audit.reply).toBe("hello!");
  });

  it("passes live (not patient) options and aborts the signal at the deadline", async () => {
    const client = new FakeClient();
    client.behaviour.reply = { hang: true };
    const guard = new FirstRead({ client, deadlineMs: 20 });
    await guard.audit(new Conversation(), "hi", "hello!");
    for (const { options } of client.calls) {
      expect(options?.patient).toBeFalsy();
      expect(options?.signal?.aborted).toBe(true);
    }
  });
});

describe("failing closed", () => {
  function hanging(check: Check) {
    const client = new FakeClient();
    client.behaviour[check] = { hang: true };
    return { client, guard: new FirstRead({ client, deadlineMs: 20 }) };
  }

  it("sends the holding reply, not the draft, when the user check times out", async () => {
    const { guard } = hanging("user");
    const conv = new Conversation();
    const audit = await guard.audit(conv, "hi", "draft");
    expect(audit.failures).toEqual([{ check: "user", reason: "timeout" }]);
    expect(audit.action).toBe("replace");
    expect(audit.reply).toBe(HOLDING_REPLY);
    expect(audit.userSignals).toBeNull();
    expect(audit.level).toBe("NONE");
    expect(conv.turns.at(-1)?.text).toBe(HOLDING_REPLY);
  });

  it("sends the safe reply when the reply check fails on an elevated conversation", async () => {
    const { client, guard } = hanging("reply");
    client.overrides.plan = 0.5; // this turn's user check says ELEVATED
    const audit = await guard.audit(new Conversation(), "...", "draft");
    expect(audit.level).toBe("ELEVATED");
    expect(audit.failures).toEqual([{ check: "reply", reason: "timeout" }]);
    expect(audit.reply).toBe(SAFE_REPLY);
  });

  it("still escalates when the user check fails on a conversation already in crisis", async () => {
    const { guard } = hanging("user");
    const conv = new Conversation();
    conv.level = "CRISIS";
    const audit = await guard.audit(conv, "...", "draft");
    expect(audit.action).toBe("escalate");
    expect(audit.reply).toBe(CRISIS_REPLY);
  });

  it("escalates when this turn's user check finds a crisis, even if the reply check fails", async () => {
    const { client, guard } = hanging("reply");
    client.overrides.intent = 0.9;
    const audit = await guard.audit(new Conversation(), "...", "draft");
    expect(audit.action).toBe("escalate");
    expect(audit.reply).toBe(CRISIS_REPLY);
  });

  it("records why a check failed", async () => {
    const client = new FakeClient();
    client.behaviour.user = { error: APIError.fromResponse(429, {}, new Headers()) };
    client.behaviour.reply = { error: APIError.fromResponse(503, {}, new Headers()) };
    const audit = await new FirstRead({ client }).audit(new Conversation(), "hi", "draft");
    expect(audit.failures).toEqual([
      { check: "user", reason: "rate_limited" },
      { check: "reply", reason: "unavailable" },
    ]);
    expect(audit.reply).toBe(HOLDING_REPLY);
  });
});

describe("FirstRead.recheck", () => {
  it("re-runs a failed turn patiently and raises the level if it was risky", async () => {
    const client = new FakeClient();
    client.behaviour.user = { hang: true };
    const guard = new FirstRead({ client, deadlineMs: 20 });
    const conv = new Conversation();
    await guard.audit(conv, "earlier", "reply");
    const audit = await guard.audit(conv, "i want to die", "draft");
    await guard.audit(conv, "later", "reply");

    client.behaviour.user = {};
    client.overrides.ideation = 0.9;
    const result = await guard.recheck(conv, audit.turn);
    expect(result).toMatchObject({ level: "ELEVATED", raised: true });
    expect(conv.level).toBe("ELEVATED");
    expect(client.calls.at(-1)?.options?.patient).toBe(true);

    const state = client.states.at(-1);
    expect(state).toContain("earlier");
    expect(state).toContain("LATEST USER MESSAGE:\ni want to die");
    expect(state).not.toContain("later"); // only what came before that turn
  });

  it("refuses a turn that isn't a user message", async () => {
    const { guard } = make();
    const conv = new Conversation();
    const audit = await guard.audit(conv, "hi", "hello");
    await expect(guard.recheck(conv, audit.turn + 1)).rejects.toThrow(/not a user message/);
  });
});

describe("failureReason", () => {
  it("classifies SDK errors", () => {
    expect(failureReason(new APIUserAbortError())).toBe("timeout");
    expect(failureReason(new APITimeoutError(2000))).toBe("timeout");
    expect(failureReason(APIError.fromResponse(429, {}, new Headers()))).toBe("rate_limited");
    expect(failureReason(APIError.fromResponse(503, {}, new Headers()))).toBe("unavailable");
    expect(failureReason(new APIConnectionError())).toBe("unavailable");
    expect(failureReason(APIError.fromResponse(401, {}, new Headers()))).toBe("error");
    expect(failureReason(new Error("boom"))).toBe("error");
  });
});

describe("clientConfig", () => {
  it("routes a gateway key through Vercel AI Gateway", () => {
    expect(clientConfig(undefined, { AI_GATEWAY_API_KEY: "gw-key" })).toEqual({
      apiKey: "gw-key",
      baseURL: GATEWAY_BASE_URL,
      defaultModel: "typesafe-ai/jev",
    });
  });

  it("lets a direct TypeSafe key take priority", () => {
    expect(clientConfig(undefined, { TYPESAFE_API_KEY: "ts", AI_GATEWAY_API_KEY: "gw" })).toEqual({});
  });

  it("fails clearly with no key", () => {
    expect(() => clientConfig(undefined, {})).toThrow(/AI_GATEWAY_API_KEY/);
  });
});
