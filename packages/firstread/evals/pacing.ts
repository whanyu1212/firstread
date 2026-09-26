/**
 * Keep Jev requests under a requests/minute limit, retries included.
 *
 * The SDK retries 429s and 5xxs on its own, and every retry is another request against the
 * limit. Pacing only the logical calls isn't enough: right at the limit, retries push over it
 * and cause more refusals. So the pacer is handed to the SDK as its `fetch`, and every HTTP
 * attempt takes a slot.
 */

import { createJevClient, clientConfig, type JevClient } from "../src";

export class Pacer {
  private readonly intervalMs: number;
  private nextSlot = 0;
  private reserved = 0;

  /** `rpm` undefined means no pacing. */
  constructor(rpm?: number) {
    this.intervalMs = rpm ? 60_000 / rpm : 0;
  }

  /** Wait for the next request slot. Safe to call from concurrent workers. */
  async slot(): Promise<void> {
    const now = performance.now();
    const wait = this.nextSlot - now;
    this.nextSlot = Math.max(now, this.nextSlot) + this.intervalMs;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }

  /**
   * Wait for a slot now and hold it for the next request, so the wait can happen outside a
   * timed section. A retry that follows still waits for its own slot inside `fetch`.
   */
  async reserve(): Promise<void> {
    await this.slot();
    this.reserved++;
  }

  /** `fetch` for the SDK: each attempt uses a reserved slot or waits for a new one. */
  readonly fetch = async (input: string, init?: RequestInit): Promise<Response> => {
    if (this.reserved > 0) this.reserved--;
    else await this.slot();
    return fetch(input, init);
  };
}

/** A Jev client whose every HTTP attempt, retries included, goes through `pacer`. */
export function pacedJevClient(pacer: Pacer): JevClient {
  return createJevClient({ ...clientConfig(), fetch: pacer.fetch });
}

/** Parse --rpm: undefined when absent; rejects 0, negatives, NaN and Infinity. */
export function parseRpm(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const rpm = Number(value);
  if (!Number.isFinite(rpm) || rpm <= 0) throw new Error(`--rpm must be a number greater than 0, got ${value}`);
  return rpm;
}
