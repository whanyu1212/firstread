/**
 * Per-chat state on the server, keyed by the chat id useChat sends with every request. It's the
 * only history the companion and FirstRead see: the client sends just the new message.
 *
 * In memory for now: fine for local development, but serverless instances come and go, so the
 * deployed app needs a hosted store (HY-22). The interface is async so one can drop in.
 */

import { Conversation, type RiskLevel, type Turn, rank } from "firstread";

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
  conv: { turns: Turn[]; level: RiskLevel };
  notes: Note[];
  handoffs: Handoff[];
}

export interface SessionStore {
  get(id: string): Promise<Session>;
  save(id: string, session: Session): Promise<void>;
  /** Change the latest stored session in place, e.g. adding notes after the reply is sent. */
  update(id: string, change: (session: Session) => void): Promise<void>;
}

export const MAX_NOTES = 20;

export const emptySession = (): Session => ({ conv: { turns: [], level: "NONE" }, notes: [], handoffs: [] });

export function toConversation(state: Session["conv"]): Conversation {
  const conv = new Conversation();
  conv.turns = state.turns.map((t) => ({ ...t }));
  conv.level = state.level;
  return conv;
}

export const fromConversation = (conv: Conversation): Session["conv"] => ({
  turns: conv.turns.map((t) => ({ ...t })),
  level: conv.level,
});

/**
 * Sessions expire after `ttlMs` without use, and the oldest are dropped past `maxSessions`, so a
 * public endpoint can't grow memory without bound. A write never lowers the stored risk level: a
 * stale copy saved late must not undo an escalation (only a reviewer may lower it, HY-20).
 */
export function memorySessionStore({ ttlMs = 2 * 60 * 60 * 1000, maxSessions = 500 } = {}): SessionStore {
  const sessions = new Map<string, { session: Session; touched: number }>();

  const current = (id: string, now: number): Session | undefined => {
    const entry = sessions.get(id);
    return entry && now - entry.touched <= ttlMs ? entry.session : undefined;
  };

  const put = (id: string, session: Session, now: number) => {
    const stored = current(id, now);
    const next = structuredClone(session);
    if (stored && rank(stored.conv.level) > rank(next.conv.level)) next.conv.level = stored.conv.level;
    sessions.delete(id);
    sessions.set(id, { session: next, touched: now });
    for (const [key, entry] of sessions) if (now - entry.touched > ttlMs) sessions.delete(key);
    // Map iterates in insertion order, and put() re-inserts, so the first keys are the oldest.
    while (sessions.size > maxSessions) sessions.delete(sessions.keys().next().value!);
  };

  return {
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
