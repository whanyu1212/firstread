/**
 * Terminal chat with a stub companion, audited by FirstRead on every turn.
 *
 *     pnpm demo
 *
 * Swap draftReply() for your real companion LLM. Every audit is appended to
 * logs/audit.jsonl, which doubles as labeled data for tuning thresholds later.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { Conversation, FirstRead } from "../src";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const LOG_DIR = here("../logs");

try {
  process.loadEnvFile(here("../../../.env"));
} catch {
  // fine if the key is already in the environment
}

function draftReply(_conv: Conversation, _userMsg: string): string {
  // TODO: call your companion LLM here with conv.turns + userMsg.
  return "That sounds like a lot. Want to tell me more about what's been going on?";
}

const guard = new FirstRead();
const conv = new Conversation();
const rl = createInterface({ input: process.stdin, output: process.stdout });
mkdirSync(LOG_DIR, { recursive: true });
rl.on("close", () => process.exit(0));
console.log("FirstRead demo. Ctrl+C to quit.\n");

while (true) {
  const userMsg = (await rl.question("you> ")).trim();
  if (!userMsg) continue;

  const audit = await guard.audit(conv, userMsg, draftReply(conv, userMsg));

  const top = Object.entries(audit.userSignals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v.toFixed(2)}`)
    .join(" ");
  console.log(`  [level=${audit.level} action=${audit.action} ${top}]`);
  if (audit.action === "escalate") {
    console.log("  [!! human reviewer alerted]"); // TODO: wire to Slack / pager / dashboard
  }
  console.log(`bot> ${audit.reply}\n`);

  appendFileSync(`${LOG_DIR}/audit.jsonl`, JSON.stringify(audit) + "\n");
}
