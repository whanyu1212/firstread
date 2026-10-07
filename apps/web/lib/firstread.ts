import "server-only";
import { FirstRead, type JevClient } from "firstread";
import { DEMO_REPLIES } from "./replies";

/** The demo's guard: Jev through AI Gateway (AI_GATEWAY_API_KEY), with the demo's replies. */
export const guard = new FirstRead({ replies: DEMO_REPLIES });

/** A Jev that's down: every check fails, so every turn fails closed. */
const unreachableJev: JevClient = {
  async ask() {
    throw new Error("Jev is switched off for this demo turn");
  },
};

/**
 * For the demo's "Jev down" switch: shows fail-closed live. It can only make a turn more cautious
 * (no draft is ever sent unchecked), so it's safe to honour from any visitor.
 */
export const guardWithJevDown = new FirstRead({ client: unreachableJev, replies: DEMO_REPLIES, deadlineMs: 500 });
