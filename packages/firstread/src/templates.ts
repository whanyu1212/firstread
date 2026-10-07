/**
 * Fallback replies used when a draft is blocked.
 *
 * The defaults below are US-centric (988). For a verified local set, pass
 * `replies: repliesFor("SG")` to FirstRead (see resources.ts for the countries covered).
 */

import { formatResources, resourcesFor } from "./resources";

export const RESOURCES =
  "If you're in the US, you can call or text 988 to reach the Suicide & Crisis Lifeline, " +
  "any time. Outside the US, findahelpline.com lists free, confidential lines near you. " +
  "If you're in immediate danger, please contact your local emergency number.";

const SAFE_INTRO =
  "I'm really glad you told me this, and I want to make sure you get the right support. " +
  "It sounds like you're carrying a lot right now. " +
  "Talking to someone trained to help can make a real difference. ";

const CRISIS_INTRO =
  "Thank you for trusting me with this. Your safety matters most right now. " +
  "I'm bringing in a person from our team, and I'd also really encourage you to reach " +
  "out to someone right now. ";

export const SAFE_REPLY = SAFE_INTRO + RESOURCES;

export const CRISIS_REPLY = CRISIS_INTRO + RESOURCES;

/**
 * Sent when the safety checks couldn't run in time and nothing so far suggests risk.
 * Deliberately low-key: most of these turns are ordinary, and the next turn is checked as usual.
 */
export const HOLDING_REPLY =
  "I want to make sure I give you a thoughtful answer. " +
  "Could you tell me a little more about what's on your mind?";

/** The three replies FirstRead sends instead of a draft. */
export interface Replies {
  /** The draft was replaced (ELEVATED, or a harmful draft). */
  safe: string;
  /** CRISIS: a human is alerted. */
  crisis: string;
  /** The checks couldn't run in time and nothing so far suggests risk. */
  holding: string;
}

export const DEFAULT_REPLIES: Replies = { safe: SAFE_REPLY, crisis: CRISIS_REPLY, holding: HOLDING_REPLY };

/** The replies with a country's verified support lines in place of the US-centric defaults. */
export function repliesFor(country: string): Replies {
  const resources = formatResources(resourcesFor(country));
  return { safe: SAFE_INTRO + resources, crisis: CRISIS_INTRO + resources, holding: HOLDING_REPLY };
}
