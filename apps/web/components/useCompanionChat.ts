"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ChatMessage, JEV_DOWN_HEADER, OPENAI_KEY_HEADER } from "@/lib/chat";
import type { Scenario } from "@/lib/scenarios";
import { useOpenAIKey } from "./OpenAIKeyField";

/** Pause between a reply and the next scripted message, so the audience can read it. */
const SCENARIO_PAUSE_MS = 1500;

/**
 * The demo's chat state, shared by the chat and the risk panel: the visitor's key, the "Jev down"
 * switch, a "new conversation" reset, and scripted scenarios played one message at a time.
 */
export function useCompanionChat() {
  const { key, setKey, forget } = useOpenAIKey();
  const [jevDown, setJevDown] = useState(false);
  // The transport lives for the component's lifetime, so it reads these through a ref.
  const live = useRef({ key, jevDown });
  live.current = { key, jevDown };
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        headers: (): Record<string, string> => ({
          ...(live.current.key ? { [OPENAI_KEY_HEADER]: live.current.key } : {}),
          ...(live.current.jevDown ? { [JEV_DOWN_HEADER]: "1" } : {}),
        }),
        // Only the new message: the history FirstRead and the companion use is kept on the server.
        prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, message: messages.at(-1) } }),
      }),
  );
  // A new id is a new conversation, here and on the server (a fresh risk state).
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const chat = useChat<ChatMessage>({ id: chatId, transport });
  const busy = chat.status === "submitted" || chat.status === "streaming";

  const [scenario, setScenario] = useState<{ scenario: Scenario; next: number } | null>(null);

  const newConversation = useCallback(() => {
    setScenario(null);
    setChatId(crypto.randomUUID());
  }, []);

  const playScenario = useCallback((s: Scenario) => {
    setChatId(crypto.randomUUID());
    setScenario({ scenario: s, next: 0 });
  }, []);

  const send = chat.sendMessage;
  // Send the next scripted message once the previous reply is in.
  useEffect(() => {
    if (!scenario || busy) return;
    if (chat.error) return setScenario(null);
    const { scenario: s, next } = scenario;
    if (next >= s.messages.length) return setScenario(null);
    const timer = setTimeout(
      () => {
        send({ text: s.messages[next]! });
        setScenario({ scenario: s, next: next + 1 });
      },
      next === 0 ? 0 : SCENARIO_PAUSE_MS,
    );
    return () => clearTimeout(timer);
  }, [scenario, busy, chat.error, send]);

  return {
    ...chat,
    busy,
    key,
    setKey,
    forgetKey: forget,
    jevDown,
    setJevDown,
    newConversation,
    playScenario,
    playing: scenario?.scenario ?? null,
    stopScenario: () => setScenario(null),
  };
}

export type CompanionChatState = ReturnType<typeof useCompanionChat>;
