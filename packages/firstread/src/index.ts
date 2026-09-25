/** FirstRead: audit every turn of a mental health companion before it reaches the user. */

export { Conversation, FirstRead } from "./guard";
export type { Check, CheckFailure, FirstReadOptions, PendingTurn, Role, Turn, TurnAudit } from "./guard";
export {
  GATEWAY_BASE_URL,
  GATEWAY_MODEL,
  LIVE_REQUEST,
  clientConfig,
  createJevClient,
  failureReason,
} from "./jev";
export type { AskOptions, FailureReason, JevClient, NoulQuestion } from "./jev";
export {
  RISK_LEVELS,
  assessLevel,
  atLeast,
  decideAction,
  escalate,
  failClosedAction,
  rank,
} from "./policy";
export type { Action, RiskLevel } from "./policy";
export { REPLY_QUESTIONS, USER_TURN_QUESTIONS } from "./questions";
export type { ReplySignals, UserSignals } from "./questions";
export { CRISIS_REPLY, HOLDING_REPLY, RESOURCES, SAFE_REPLY } from "./templates";
