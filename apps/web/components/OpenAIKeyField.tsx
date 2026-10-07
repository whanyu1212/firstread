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

/** The key form. Once a key is in, a line saying whose key is in use, with a way to forget it. */
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
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <span>Using your OpenAI key, ending {value.slice(-4)}. It stays in this tab.</span>
        <button type="button" onClick={onForget} className="shrink-0 text-accent hover:underline">
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
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="openai-key" className="block font-semibold">
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
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 font-mono text-sm outline-none placeholder:text-muted focus-visible:border-muted focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-9 rounded-md bg-ink px-3 text-sm font-medium text-canvas hover:bg-ink/90 disabled:opacity-40"
        >
          Use key
        </button>
      </div>
      <p className="max-w-[70ch] text-xs text-muted">
        It stays in this browser tab and is sent with each message to our server, which uses it for that reply only
        and never stores or logs it. A project key with a low spending limit is a good idea.
      </p>
    </form>
  );
}
