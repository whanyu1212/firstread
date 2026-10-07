"use client";

import { type FormEvent, useEffect, useState } from "react";

const STORAGE_KEY = "firstread.openaiKey";

/**
 * The visitor's own OpenAI key (HY-153), kept in this tab only (sessionStorage) and sent with each
 * chat request. Storage can be unavailable (private windows, blocked site data), so every access is
 * guarded and the key then lives in memory for the page's lifetime.
 */
export function useOpenAIKey() {
  const [key, setKeyState] = useState("");

  useEffect(() => {
    try {
      setKeyState(sessionStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      // no storage: keep it in memory only
    }
  }, []);

  const setKey = (value: string) => {
    setKeyState(value);
    try {
      if (value) sessionStorage.setItem(STORAGE_KEY, value);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // no storage: keep it in memory only
    }
  };

  return { key, setKey, forget: () => setKey("") };
}

export function OpenAIKeyField({
  value,
  onSave,
  onForget,
}: {
  value: string;
  onSave: (key: string) => void;
  onForget: () => void;
}) {
  const [draft, setDraft] = useState("");

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-xs text-muted">
        <span>Using your OpenAI key (ends {value.slice(-4)}). It stays in this tab.</span>
        <button type="button" onClick={onForget} className="shrink-0 underline hover:text-ink">
          Forget key
        </button>
      </div>
    );
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const key = draft.trim();
    if (!key) return;
    onSave(key);
    setDraft("");
  }

  return (
    <form onSubmit={save} className="space-y-2 border-b border-line p-4">
      <label htmlFor="openai-key" className="block text-sm font-medium">
        To chat live, use your own OpenAI API key
      </label>
      <div className="flex gap-2">
        <input
          id="openai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-..."
          className="min-w-0 flex-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-xl border border-line px-3 py-2 text-sm hover:border-accent disabled:opacity-40"
        >
          Use key
        </button>
      </div>
      <p className="text-xs text-muted">
        It stays in this browser tab and is sent with each message to our server, which uses it for that reply only
        and never stores or logs it. A project key with a low spending limit is a good idea.
      </p>
    </form>
  );
}
