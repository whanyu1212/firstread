/**
 * Per-chat state on the server, keyed by the chat id useChat sends with every request.
 *
 * In memory for now: fine for local development, but serverless instances come and go, so the
 * deployed app needs a hosted store (HY-22). The interface is async so one can drop in.
 */

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
  notes: Note[];
  handoffs: Handoff[];
}

export interface SessionStore {
  get(id: string): Promise<Session>;
  save(id: string, session: Session): Promise<void>;
}

export const MAX_NOTES = 20;

const emptySession = (): Session => ({ notes: [], handoffs: [] });

/**
 * Sessions expire after `ttlMs` without use, and the oldest are dropped past `maxSessions`, so a
 * public endpoint can't grow memory without bound.
 */
export function memorySessionStore({ ttlMs = 2 * 60 * 60 * 1000, maxSessions = 500 } = {}): SessionStore {
  const sessions = new Map<string, { session: Session; touched: number }>();

  const sweep = (now: number) => {
    for (const [id, entry] of sessions) if (now - entry.touched > ttlMs) sessions.delete(id);
    // Map iterates in insertion order, and save() re-inserts, so the first keys are the oldest.
    while (sessions.size > maxSessions) sessions.delete(sessions.keys().next().value!);
  };

  return {
    async get(id) {
      const entry = sessions.get(id);
      if (!entry || Date.now() - entry.touched > ttlMs) return emptySession();
      return structuredClone(entry.session);
    },
    async save(id, session) {
      const now = Date.now();
      sessions.delete(id);
      sessions.set(id, { session: structuredClone(session), touched: now });
      sweep(now);
    },
  };
}
