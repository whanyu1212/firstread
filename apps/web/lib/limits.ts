/**
 * How much of the demo one visitor can use (HY-153), so a public URL can't spend our budgets: a
 * cap on turns per conversation, and per IP, turns per minute and per day. The per-day cap and the
 * per-conversation cap only apply on our OpenAI key; with their own key a visitor pays for the
 * companion, and only the per-minute cap protects Jev. Counted in Redis, so the limits hold across
 * serverless instances. A production server without Redis doesn't use our key at all (the chat
 * route refuses it), since the per-IP limits couldn't hold.
 */

export const LIMITS = { turnsPerChat: 30, perMinute: 8, perDay: 60 } as const;

/** The counter commands the limits use, so tests can stand in for Upstash. */
export interface CounterStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

/** Counts one turn in a fixed window, and says whether it's over `max`. */
async function over(store: CounterStore, key: string, max: number, seconds: number): Promise<boolean> {
  const count = await store.incr(key);
  if (count === 1) await store.expire(key, seconds);
  return count > max;
}

const OWN_KEY = "add your own OpenAI key to keep going.";

/**
 * Why this conversation can't take another message on our key, or null if it can. Checked inside
 * the chat's turn lock, so two requests sent at once can't both slip under the cap.
 */
export function chatCapRefusal(turns: number, ourKey: boolean): string | null {
  return ourKey && turns >= LIMITS.turnsPerChat
    ? `This demo conversation has reached its ${LIMITS.turnsPerChat} messages. Start a new one, or ${OWN_KEY}`
    : null;
}

/** Why this visitor can't send a message right now, in words for them, or null if they can. */
export async function rateRefusal({
  store,
  ip,
  ourKey,
  now = Date.now(),
}: {
  store: CounterStore;
  ip: string;
  ourKey: boolean;
  now?: number;
}): Promise<string | null> {
  const minute = Math.floor(now / 60_000);
  if (await over(store, `firstread:rate:min:${ip}:${minute}`, LIMITS.perMinute, 60)) {
    return "That's a lot of messages in a minute. Please wait a moment and try again.";
  }
  const day = Math.floor(now / 86_400_000);
  if (ourKey && (await over(store, `firstread:rate:day:${ip}:${day}`, LIMITS.perDay, 86_400))) {
    return `You've used today's ${LIMITS.perDay} live messages on the demo's key. To go further, ${OWN_KEY}`;
  }
  return null;
}

/** The visitor's IP, as Vercel passes it. */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
