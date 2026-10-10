import { describe, expect, it } from "vitest";
import { probabilitiesFromLogprobs, probabilitiesFromText } from "../evals/llm-client";

const tok = (token: string, alts: [string, number][] = [[token, 1]]) => ({
  token,
  logprob: Math.log(alts[0]![1]),
  top_logprobs: alts.map(([t, p]) => ({ token: t, logprob: Math.log(p) })),
});

describe("probabilitiesFromLogprobs", () => {
  it("reads P(true) at each boolean, normalised over true/false alternatives", () => {
    const tokens = [
      tok('{"'),
      tok("ide"),
      tok("ation"),
      tok('":'),
      tok("false", [
        ["false", 0.6],
        [" false", 0.2],
        ["true", 0.1],
        ["{", 0.1],
      ]),
      tok(',"'),
      tok("plan"),
      tok('":'),
      tok("true"),
      tok("}"),
    ];
    const p = probabilitiesFromLogprobs(tokens, ["ideation", "plan"]);
    expect(p.ideation).toBeCloseTo(0.1 / 0.9);
    expect(p.plan).toBe(1);
  });

  it("throws when a key has no boolean", () => {
    expect(() => probabilitiesFromLogprobs([tok('{"plan":'), tok("true"), tok("}")], ["plan", "intent"])).toThrow(
      /intent/,
    );
  });
});

describe("probabilitiesFromText", () => {
  it("reads the first JSON object, fenced or not, and clamps to 0-1", () => {
    const p = probabilitiesFromText('```json\n{"ideation": 0.9, "plan": "0.2", "intent": 1.4}\n```', ["ideation", "plan", "intent"]);
    expect(p).toEqual({ ideation: 0.9, plan: 0.2, intent: 1 });
  });

  it("throws on a missing or non-numeric value instead of scoring NaN", () => {
    expect(() => probabilitiesFromText('{"ideation": 0.9}', ["ideation", "plan"])).toThrow(/plan/);
    expect(() => probabilitiesFromText('{"ideation": "high"}', ["ideation"])).toThrow(/ideation/);
    expect(() => probabilitiesFromText("I can't answer that.", ["ideation"])).toThrow(/no JSON object/);
    expect(() => probabilitiesFromText('{"ideation": ""}', ["ideation"])).toThrow(/ideation/);
  });

  it("skips brace groups that aren't the answer, before or after it", () => {
    expect(probabilitiesFromText('Probabilities use {0..1}: {"ideation": 0.3}', ["ideation"])).toEqual({ ideation: 0.3 });
    expect(probabilitiesFromText('{"note": "x"} {"ideation": 0.4}', ["ideation"])).toEqual({ ideation: 0.4 });
  });

  it("reads the first object when text with braces follows it", () => {
    expect(probabilitiesFromText('{"ideation": 0.3} (scale {0..1})', ["ideation"])).toEqual({ ideation: 0.3 });
  });
});
