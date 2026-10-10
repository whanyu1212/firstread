/**
 * Why the runtime recorded a handoff, as the reason it stores and sends to the page. Shared so the
 * page can tell a person's own request from a CRISIS escalation, including in recordings.
 */
export const HANDOFF_REASON = {
  crisis: "FirstRead escalated the conversation to CRISIS",
  request: "The person asked to talk to a real person",
} as const;

export const handoffAsked = (reason: string): boolean => reason === HANDOFF_REASON.request;

/** The margin's line for a handoff: only a person's own request is called one. */
export const handoffLine = (reason: string): string =>
  handoffAsked(reason)
    ? "Recorded a request for a person. No one is on call for the demo."
    : "A person would be alerted in a real deployment. No one is on call for the demo.";
