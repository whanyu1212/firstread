/** Guard wiring tests with a fake Jev client (no API key needed). */

import { describe, expect, it } from "vitest";
import { Conversation, FirstRead } from "../src/guard";
import { GATEWAY_BASE_URL, type JevClient, clientConfig } from "../src/jev";
import { CRISIS_REPLY } from "../src/templates";

/** Answers every question with a fixed probability, overridable per key. */
class FakeClient implements JevClient {
  overrides: Record<string, number> = {};
  states: string[] = [];

  async ask<K extends string>(state: string, questions: Record<K, unknown>) {
    this.states.push(state);
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
