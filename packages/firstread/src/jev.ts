/**
 * Thin adapter over Jev, so the rest of the library never touches the SDK.
 *
 * Uses TypeSafe's own SDK (@typesafe-ai/sdk). A direct TypeSafe key wins;
 * otherwise requests go through Vercel AI Gateway's TypeSafe-compatible endpoint
 * with the gateway key.
 *
 * Server-side only: the SDK refuses to run in a browser, which would expose the
 * key. Don't set TYPESAFE_LOG_LEVEL=debug in production either: debug logs
 * include request bodies, i.e. users' messages.
 */

import { type NoulQuestion, TypeSafeClient, type TypeSafeClientConfig } from "@typesafe-ai/sdk";

export const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/typesafe";
export const GATEWAY_MODEL = "typesafe-ai/jev";

export type { NoulQuestion };

export interface JevClient {
  /** Ask yes/no questions about one state. Returns P(yes) per question key, 0 to 1. */
  ask<K extends string>(
    state: string,
    questions: Record<K, NoulQuestion>,
  ): Promise<Record<K, number>>;
}

type Env = Record<string, string | undefined>;

export function clientConfig(
  model: string | undefined = process.env.FIRSTREAD_MODEL,
  env: Env = process.env,
): TypeSafeClientConfig {
  if (env.TYPESAFE_API_KEY) {
    return model ? { defaultModel: model } : {};
  }
  if (env.AI_GATEWAY_API_KEY) {
    return {
      apiKey: env.AI_GATEWAY_API_KEY,
      baseURL: GATEWAY_BASE_URL,
      defaultModel: model ?? GATEWAY_MODEL,
    };
  }
  throw new Error("Set AI_GATEWAY_API_KEY (Vercel) or TYPESAFE_API_KEY in .env");
}

export function createJevClient(config: TypeSafeClientConfig = clientConfig()): JevClient {
  const client = new TypeSafeClient(config);
  return {
    async ask(state, questions) {
      const { answers } = await client.systemOne({ state, questions });
      const probabilities = {} as Record<keyof typeof questions, number>;
      for (const key of Object.keys(questions) as (keyof typeof questions)[]) {
        probabilities[key] = answers[key].noul;
      }
      return probabilities;
    },
  };
}
