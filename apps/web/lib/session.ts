/**
 * Per-chat state on the server, keyed by the chat id useChat sends with every request. It's the
 * only history the companion and FirstRead see: the client sends just the new message.
 *
 * In memory for now: fine for local development, but serverless instances come and go, so the
 * deployed app needs a hosted store (HY-22). The interface is async so one can drop in.
 */

import { Conversation, type RiskState, type Turn, initialRisk } from "firstread";

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
 * Sessions expire after `ttlMs` without use, and the oldest are dropped past `maxSessions`, so a
 * public endpoint can't grow memory without bound. A stale copy can't undo a newer turn: if the
 * stored conversation's risk version is newer, it's kept (the level may legitimately come down now,
 * so "keep the higher level" would be wrong).
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
    if (stored) {
      if (stored.conv.risk.version > next.conv.risk.version) next.conv = structuredClone(stored.conv);
      // Notes and handoffs only accumulate, so keep any that were added after this copy was read
      // (e.g. a background note saved while the next turn was running).
      next.notes = union(next.notes, stored.notes, (n) => n.text).slice(0, MAX_NOTES);
      next.handoffs = union(next.handoffs, stored.handoffs, (h) => `${h.at}|${h.reason}`);
    }
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
