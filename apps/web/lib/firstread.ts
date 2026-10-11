import "server-only";
import { FirstRead, type JevClient, clientConfig, createJevClient } from "firstread";
import { DEMO_REPLIES } from "./replies";

let live: FirstRead | undefined;

/**
 * The demo's guard: Jev through AI Gateway (AI_GATEWAY_API_KEY), with the demo's replies. Made on
 * the first turn rather than when the module loads, so the app builds, and serves the deck and the
 * replays, without a key. Null when no Jev key is set: the route refuses live turns then.
 */
export function liveGuard(): FirstRead | null {
  if (!live) {
    let config: ReturnType<typeof clientConfig>;
    try {
      config = clientConfig();
    } catch {
      return null;
    }
    live = new FirstRead({ client: createJevClient(config), replies: DEMO_REPLIES });
  }
  return live;
}

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
