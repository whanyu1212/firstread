/**
 * The FirstRead guard: two Jev calls per turn.
 *
 *     user message --> checkUser() --> risk level (sticky per conversation)
 *                                            |
 *     companion LLM --> draft reply --> checkReply() --> send | replace | escalate
 *
 * audit() runs both Jev calls at the same time: the reply check's questions
 * don't depend on the risk level, only the final decision does.
 */

import { type JevClient, createJevClient } from "./jev";
import { type Action, type RiskLevel, assessLevel, decideAction, escalate } from "./policy";
import {
  REPLY_QUESTIONS,
  type ReplySignals,
  USER_TURN_QUESTIONS,
  type UserSignals,
} from "./questions";
import { CRISIS_REPLY, SAFE_REPLY } from "./templates";

export type Role = "user" | "assistant";
export type Turn = { role: Role; text: string };

export class Conversation {
  turns: Turn[] = [];
  level: RiskLevel = "NONE";

  add(role: Role, text: string): void {
    this.turns.push({ role, text });
  }
}

export interface TurnAudit {
  level: RiskLevel;
  action: Action;
  userSignals: UserSignals;
  replySignals: ReplySignals;
  draft: string;
  /** What actually goes to the user. */
  reply: string;
}

export interface FirstReadOptions {
  /** Any JevClient; tests pass a fake. Defaults to Jev via TypeSafe's SDK. */
  client?: JevClient;
  /** How many recent turns Jev sees, so risk that builds across turns is not judged one message at a time. */
  window?: number;
}

const REPLY_FOR: Record<Action, (draft: string) => string> = {
  send: (draft) => draft,
  replace: () => SAFE_REPLY,
  escalate: () => CRISIS_REPLY,
};

export class FirstRead {
  private readonly client: JevClient;
  private readonly window: number;

  constructor({ client, window = 8 }: FirstReadOptions = {}) {
    this.client = client ?? createJevClient();
    this.window = window;
  }

  async checkUser(
    conv: Conversation,
    userMsg: string,
  ): Promise<{ level: RiskLevel; signals: UserSignals }> {
    const signals = await this.client.ask(this.userState(conv, userMsg), USER_TURN_QUESTIONS);
    conv.level = escalate(conv.level, assessLevel(signals));
    return { level: conv.level, signals };
  }

  async checkReply(
    conv: Conversation,
    userMsg: string,
    draft: string,
  ): Promise<{ action: Action; signals: ReplySignals }> {
    const signals = await this.client.ask(this.replyState(conv, userMsg, draft), REPLY_QUESTIONS);
    return { action: decideAction(conv.level, signals), signals };
  }

  /** Run both checks, pick the reply to send, and record the turn. */
  async audit(conv: Conversation, userMsg: string, draft: string): Promise<TurnAudit> {
    const [userSignals, replySignals] = await Promise.all([
      this.client.ask(this.userState(conv, userMsg), USER_TURN_QUESTIONS),
      this.client.ask(this.replyState(conv, userMsg, draft), REPLY_QUESTIONS),
    ]);
    conv.level = escalate(conv.level, assessLevel(userSignals));
    const action = decideAction(conv.level, replySignals);
    const reply = REPLY_FOR[action](draft);

    conv.add("user", userMsg);
    conv.add("assistant", reply);
    return { level: conv.level, action, userSignals, replySignals, draft, reply };
  }

  private userState(conv: Conversation, userMsg: string): string {
    return `${this.transcript(conv)}\n\nLATEST USER MESSAGE:\n${userMsg}`;
  }

  private replyState(conv: Conversation, userMsg: string, draft: string): string {
    return `${this.userState(conv, userMsg)}\n\nDRAFT ASSISTANT REPLY:\n${draft}`;
  }

  private transcript(conv: Conversation): string {
    const recent = conv.turns.slice(-this.window);
    if (recent.length === 0) return "CONVERSATION SO FAR: (none)";
    const lines = recent.map(({ role, text }) => `${role.toUpperCase()}: ${text}`);
    return `CONVERSATION SO FAR:\n${lines.join("\n")}`;
  }
}
