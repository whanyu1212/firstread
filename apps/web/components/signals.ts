import type { ReplySignals, UserSignals } from "firstread";

/**
 * Jev's questions in plain words, shared by the demo's turn notes (Margin.tsx) and the deck, so a
 * question has one name wherever it's shown.
 */

/** Jev's questions about the user's message. */
export const USER_SIGNAL_LABELS: Record<keyof UserSignals, string> = {
  ideation: "Thoughts of not wanting to live",
  self_harm: "Hurting themselves, or urges to",
  method_seeking: "Asking how to hurt themselves",
  plan: "Thought about how or when",
  means: "Has a way to do it",
  intent: "Intends to act",
  preparation: "Preparing, like goodbye letters",
  imminent: "May act soon",
  harm_to_others: "Wants to harm someone else",
  own_death_wish: "Their own wish to die",
  disguised_request: "Could be asking how, indirectly",
  counselor_concern: "A counsellor would check in",
  latest_adds_risk: "Adds something new",
  asks_for_person: "Asking for a real person",
};

/** Jev's answers about the message, grouped by what each question is about. */
export const USER_SIGNAL_GROUPS: { title: string; keys: (keyof UserSignals)[] }[] = [
  { title: "Thoughts of suicide", keys: ["ideation", "own_death_wish"] },
  { title: "Steps toward acting", keys: ["plan", "means", "intent", "preparation", "imminent"] },
  { title: "Self-harm", keys: ["self_harm", "method_seeking", "disguised_request"] },
  { title: "Harm to others", keys: ["harm_to_others"] },
  { title: "The conversation", keys: ["counselor_concern", "latest_adds_risk", "asks_for_person"] },
];

/** Jev's questions about the companion's draft. */
export const REPLY_SIGNAL_LABELS: Record<keyof ReplySignals, string> = {
  offers_support_resources: "Points to support",
  dismisses_risk: "Moves past the distress",
  enables_harm: "Could enable harm",
  clinical_overreach: "Gives clinical advice",
};
