/**
 * Per-chat state on the server, keyed by the chat id useChat sends with every request. It's the
 * only history the companion and FirstRead see: the client sends just the new message.
 *
 * Two stores behind one interface: in memory for local development, and Redis for the deployed
 * app (HY-22), where serverless instances come and go and the next message may reach a different
 * one. Both apply the same merge rules, so a late or racing write can't undo a turn.
 */

import { Conversation, type RiskState, type Turn, initialRisk, rank } from "firstread";

export interface Note {
  kind: "coping" | "preference" | "other";
  text: string;
  at: string;
}

export interface Handoff {
  reason: string;
  at: string;
}

export interface Session {
  /** FirstRead's conversation as plain data: a stored class instance would lose its methods. */
  conv: { turns: Turn[]; risk: RiskState };
  notes: Note[];
  handoffs: Handoff[];
}

export interface SessionStore {
  get(id: string): Promise<Session>;
  save(id: string, session: Session): Promise<void>;
  /** Change the latest stored session in place, e.g. adding notes after the reply is sent. */
  update(id: string, change: (session: Session) => void): Promise<void>;
  /**
   * Run `work` with this chat's turns one at a time, so two requests can't both read the same
   * session and race to save it: within one instance in memory, across instances in Redis.
   */
  lock<T>(id: string, work: () => Promise<T>): Promise<T>;
}

export const MAX_NOTES = 20;

/** `ours`, then anything in `theirs` with a key not already present. */
function union<T>(ours: T[], theirs: T[], key: (item: T) => string): T[] {
  const seen = new Set(ours.map(key));
  return [...ours, ...theirs.filter((item) => !seen.has(key(item)))];
}

export const emptySession = (): Session => ({ conv: { turns: [], risk: initialRisk() }, notes: [], handoffs: [] });

export function toConversation(state: Session["conv"]): Conversation {
  const conv = new Conversation();
  conv.turns = state.turns.map((t) => ({ ...t }));
  conv.risk = structuredClone(state.risk);
  return conv;
}

export const fromConversation = (conv: Conversation): Session["conv"] => ({
  turns: conv.turns.map((t) => ({ ...t })),
  risk: structuredClone(conv.risk),
});

/**
 * What to store when `session` is saved over `stored`. A stale copy can't undo a newer turn: if the
 * stored conversation's risk version is newer, it's kept (the level may legitimately come down now,
 * so "keep the higher level" would be wrong). Notes and handoffs only accumulate, so any added after
 * `session` was read are kept.
 */
export function mergeSession(stored: Session | undefined, session: Session): Session {
  const next = structuredClone(session);
  if (!stored) return next;
  const s = stored.conv.risk;
  const n = next.conv.risk;
  // Keep the stored conversation if it's newer, or if both came from the same base and the stored
  // one is at a higher level: a racing write must never undo an escalation.
  if (s.version > n.version || (s.version === n.version && rank(s.level) > rank(n.level))) {
    next.conv = structuredClone(stored.conv);
  }
  // E.g. a background note saved while the next turn was running.
  next.notes = union(next.notes, stored.notes, (n) => n.text).slice(0, MAX_NOTES);
  next.handoffs = union(next.handoffs, stored.handoffs, (h) => `${h.at}|${h.reason}`);
  return next;
}

/**
 * Sessions expire after `ttlMs` without use, and the oldest are dropped past `maxSessions`, so a
 * public endpoint can't grow memory without bound.
 */
export function memorySessionStore({ ttlMs = 2 * 60 * 60 * 1000, maxSessions = 500 } = {}): SessionStore {
  const sessions = new Map<string, { session: Session; touched: number }>();

  const current = (id: string, now: number): Session | undefined => {
    const entry = sessions.get(id);
    return entry && now - entry.touched <= ttlMs ? entry.session : undefined;
  };

  const put = (id: string, session: Session, now: number) => {
    const next = mergeSession(current(id, now), session);
    sessions.delete(id);
    sessions.set(id, { session: next, touched: now });
    for (const [key, entry] of sessions) if (now - entry.touched > ttlMs) sessions.delete(key);
    // Map iterates in insertion order, and put() re-inserts, so the first keys are the oldest.
    while (sessions.size > maxSessions) sessions.delete(sessions.keys().next().value!);
  };

  const locks = new Map<string, Promise<unknown>>();

  return {
    lock(id, work) {
      const previous = locks.get(id) ?? Promise.resolve();
      const run = previous.then(work, work);
      const tail = run.then(
        () => {},
        () => {},
      );
      locks.set(id, tail);
      void tail.then(() => {
        if (locks.get(id) === tail) locks.delete(id);
      });
      return run;
    },
    async get(id) {
      const stored = current(id, Date.now());
      return stored ? structuredClone(stored) : emptySession();
    },
    async save(id, session) {
      put(id, session, Date.now());
    },
    async update(id, change) {
      // Read, change and write with no await in between, so nothing interleaves.
      const now = Date.now();
      const session = structuredClone(current(id, now) ?? emptySession());
      change(session);
      put(id, session, now);
    },
  };
}

/** The few Redis commands the store uses, so tests can stand in for Upstash. */
export interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts: { ex: number } | { nx: true; px: number }): Promise<unknown>;
  eval<A extends unknown[], R>(script: string, keys: string[], args: A): Promise<R>;
}

// Deletes the lock only if it's still ours: one that expired and was taken by another turn stays.
const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/**
 * Sessions in Redis (Upstash), shared by every instance, each kept for `ttlMs` after its last write.
 * Two locks, both SET NX with an expiry so a crashed instance can't hold one for ever: a chat's turn
 * lock, held for the whole turn, and a short write lock around each read-merge-write, so a turn's
 * save and a background note can't overwrite each other.
 */
export function redisSessionStore(
  redis: RedisLike,
  { ttlMs = 2 * 60 * 60 * 1000, prefix = "firstread:", turnMs = 70_000, pollMs = 100 } = {},
): SessionStore {
  const key = (id: string) => `${prefix}session:${id}`;

  async function withLock<T>(name: string, holdMs: number, work: () => Promise<T>): Promise<T> {
    const token = crypto.randomUUID();
    const deadline = Date.now() + holdMs;
    while (!(await redis.set(name, token, { nx: true, px: holdMs }))) {
      if (Date.now() > deadline) throw new Error("This chat is busy. Try again in a moment.");
      await new Promise((r) => setTimeout(r, pollMs));
    }
    try {
      return await work();
    } finally {
      await redis.eval(RELEASE, [name], [token]);
    }
  }

  const read = async (id: string) => (await redis.get<Session>(key(id))) ?? undefined;
  const write = (id: string, session: Session) => redis.set(key(id), session, { ex: Math.ceil(ttlMs / 1000) });
  const writeLock = (id: string) => `${prefix}write:${id}`;

  return {
    lock: (id, work) => withLock(`${prefix}turn:${id}`, turnMs, work),
    async get(id) {
      return (await read(id)) ?? emptySession();
    },
    async save(id, session) {
      await withLock(writeLock(id), 5_000, async () => write(id, mergeSession(await read(id), session)));
    },
    async update(id, change) {
      await withLock(writeLock(id), 5_000, async () => {
        const stored = await read(id);
        const session = structuredClone(stored ?? emptySession());
        change(session);
        await write(id, mergeSession(stored, session));
      });
    },
  };
}
