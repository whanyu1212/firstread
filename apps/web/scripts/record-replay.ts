/**
 * Record a scripted scenario through the real chat route, for the deck's replay slide (HY-159)
 * and, later, the demo's replay mode (HY-145). Each turn keeps exactly the data parts the page
 * receives, so a replay renders with the same components as a live chat.
 *
 *     pnpm --filter web dev                        # in another terminal; uses OPENAI_API_KEY from .env
 *     pnpm --filter web record:replay crisis
 *
 * Writes slides/data/replay-<scenario>.json. Spends Jev and OpenAI credits.
 */

import { writeFileSync } from "node:fs";
import type { ChatData } from "../lib/chat";
import type { RecordedTurn, Recording } from "../lib/replay";
import { SCENARIOS } from "../lib/scenarios";

const BASE = process.env.DEMO_URL ?? "http://localhost:3000";
const id = process.argv[2] ?? "crisis";
const scenario = SCENARIOS.find((s) => s.id === id);
if (!scenario) throw new Error(`unknown scenario "${id}"; one of: ${SCENARIOS.map((s) => s.id).join(", ")}`);

/** One turn through /api/chat: the UI message stream, read as server-sent events. */
async function turn(chatId: string, text: string): Promise<RecordedTurn> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: chatId,
      message: { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`chat route answered ${res.status}: ${await res.text()}`);
  const data: Partial<Record<keyof ChatData, unknown>> = {};
  let reply = "";
  for (const line of (await res.text()).split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    const part = JSON.parse(line.slice(6)) as { type: string; delta?: string; data?: unknown; errorText?: string };
    if (part.type === "text-delta") reply += part.delta ?? "";
    else if (part.type === "error") throw new Error(`stream error: ${part.errorText}`);
    else if (part.type.startsWith("data-")) data[part.type.slice(5) as keyof ChatData] = part.data;
  }
  return { user: text, reply, data: data as Partial<ChatData> };
}

const chatId = crypto.randomUUID();
const turns: RecordedTurn[] = [];
for (const text of scenario.messages) {
  const t = await turn(chatId, text);
  turns.push(t);
  console.log(`${t.data.risk?.level ?? "?"}  ${t.data.audit?.action ?? "?"}  ${text}`);
}
const recording: Recording = { scenario: scenario.id, title: scenario.title, recordedAt: new Date().toISOString(), turns };
const target = new URL(`../slides/data/replay-${scenario.id}.json`, import.meta.url).pathname;
writeFileSync(target, `${JSON.stringify(recording, null, 1)}\n`);
console.log(`wrote ${target}`);
