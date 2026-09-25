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

import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  APIUserAbortError,
  type NoulQuestion,
  RateLimitError,
  type RequestOptions,
  TypeSafeClient,
  type TypeSafeClientConfig,
} from "@typesafe-ai/sdk";

export const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/typesafe";
export const GATEWAY_MODEL = "typesafe-ai/jev";

export type { NoulQuestion };

export interface AskOptions {
  /** Cancels the request and any pending retries. */
  signal?: AbortSignal;
  /**
   * Live turns fail fast: a short timeout, one quick retry, and no long waits on a 429's
   * Retry-After. Patient calls (evals, background rechecks) use the SDK's default retries.
   */
  patient?: boolean;
}

export interface JevClient {
  /** Ask yes/no questions about one state. Returns P(yes) per question key, 0 to 1. */
  ask<K extends string>(
    state: string,
    questions: Record<K, NoulQuestion>,
    options?: AskOptions,
  ): Promise<Record<K, number>>;
}

/**
 * Per-call settings for live turns. Successful Jev calls take up to ~1.5s, so a 2s attempt
 * that hasn't answered is likely stuck. 503s cleared on a quick retry in the evals; 429s
 * asked for ~38s waits, which a live turn can't afford.
 */
export const LIVE_REQUEST: RequestOptions = {
  timeout: 2_000,
  retry: { maxRetries: 1, backoffInitialMs: 250, backoffMaxMs: 250, maxRetryAfterMs: 250 },
};

export type FailureReason = "timeout" | "rate_limited" | "unavailable" | "error";

/** Why a Jev call failed, for logs and the fail-closed audit record. */
export function failureReason(err: unknown): FailureReason {
  // APIUserAbortError: our deadline aborted it.
  if (err instanceof APIUserAbortError || err instanceof APITimeoutError) return "timeout";
  if (err instanceof RateLimitError) return "rate_limited";
  if (err instanceof APIConnectionError) return "unavailable";
  if (err instanceof APIError && err.status >= 500) return "unavailable";
  return "error";
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
    async ask(state, questions, { signal, patient = false } = {}) {
      const options = patient ? { signal } : { ...LIVE_REQUEST, signal };
      const { answers } = await client.systemOne({ state, questions }, options);
      const probabilities = {} as Record<keyof typeof questions, number>;
      for (const key of Object.keys(questions) as (keyof typeof questions)[]) {
        probabilities[key] = answers[key].noul;
      }
      return probabilities;
    },
  };
}
