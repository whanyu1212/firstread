import { describe, expect, it } from "vitest";
import { probabilitiesFromLogprobs } from "../evals/llm-client";

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
