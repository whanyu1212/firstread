/** FirstRead: audit every turn of a mental health companion before it reaches the user. */

export { Conversation, FirstRead } from "./guard";
export type { FirstReadOptions, Role, Turn, TurnAudit } from "./guard";
export { GATEWAY_BASE_URL, GATEWAY_MODEL, clientConfig, createJevClient } from "./jev";
export type { JevClient, NoulQuestion } from "./jev";
export { RISK_LEVELS, assessLevel, atLeast, decideAction, escalate, rank } from "./policy";
export type { Action, RiskLevel } from "./policy";
export { REPLY_QUESTIONS, USER_TURN_QUESTIONS } from "./questions";
export type { ReplySignals, UserSignals } from "./questions";
export { CRISIS_REPLY, RESOURCES, SAFE_REPLY } from "./templates";
