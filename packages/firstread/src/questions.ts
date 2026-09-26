/**
 * Jev question sets for the two per-turn checks.
 *
 * Every question is a yes/no `noul`, so each answer is a probability we can threshold
 * in policy.ts. Keys here must match the keys policy.ts reads.
 *
 * The user-side questions are loosely modelled on the structure of the
 * Columbia Suicide Severity Rating Scale (ideation -> plan -> intent), but this
 * is not a clinical instrument and should not be presented as one.
 */

import { type NoulQuestion, noul } from "@typesafe-ai/sdk";

export const USER_TURN_QUESTIONS = {
  ideation: noul(
    "In the latest user message, read in the context of the conversation, " +
      "does the user express thoughts of wanting to die, not wanting to be alive, " +
      "or wanting to hurt themselves? Count indirect or passive statements " +
      "(e.g. wishing they would not wake up, feeling others would be better off " +
      "without them). Do not count clear hyperbole or jokes about everyday stress.",
  ),
  self_harm: noul(
    "Does the user describe currently or recently harming themselves on purpose, " +
      "or urges to do so, including non-suicidal self-injury? Do not count accidental injuries.",
  ),
  method_seeking: noul(
    "Is the user asking how to hurt themselves, make self-inflicted injuries hurt less or heal " +
      "or fade faster, hide injuries or marks, or avoid medical care for an injury they caused " +
      "on purpose? Wanting pain or injury for 'relief', 'release', or to feel something is a " +
      "strong sign. Count practical, medical, or hypothetical framing unless the conversation " +
      "makes a harmless reason clear, such as an accident, sport, grooming, or tattoos.",
  ),
  plan: noul(
    "Does the user indicate they have thought about how, when, or where " +
      "they would end their life or harm themselves?",
  ),
  means: noul(
    "Does the user indicate they have access to a way to seriously harm themselves?",
  ),
  intent: noul(
    "Does the user indicate they intend to act on thoughts of ending their life " +
      "or harming themselves, including goodbye-style messages or giving things away?",
  ),
  preparation: noul(
    "Does the user describe preparations that could be for ending their life, such as " +
      "gathering or saving up means, writing goodbye letters, giving away belongings or pets, " +
      "saying goodbye, or putting their affairs in order? Count indirect statements (e.g. " +
      "wanting to make things easier for family, going through with 'my plan') unless the " +
      "conversation makes a harmless reason clear, such as moving, travel, a new job, or " +
        "routine life admin like making a will, insurance, or decluttering.",
  ),
  imminent: noul(
    "Does the user indicate they may act to harm themselves soon, " +
      "such as today or tonight?",
  ),
  harm_to_others: noul(
    "Does the user express a genuine wish or intent to seriously harm another person? " +
      "Do not count obvious figures of speech.",
  ),

  // Follow-ups. Asked in the same call (the rate limit counts requests, not questions), but
  // policy.ts only uses them on borderline turns, and only to raise the level.
  own_death_wish: noul(
    "Is the user describing their own feelings of not wanting to be alive, rather than " +
      "tiredness, frustration, or someone else's feelings?",
  ),
  disguised_request: noul(
    "Could this message, even if framed as research, fiction, curiosity, or for someone " +
      "else, be an indirect way of asking how to harm oneself or prepare to end one's life?",
  ),
  // Broad "needs support" signal: fires on depression, grief, addiction too, so it only sets WATCH.
  counselor_concern: noul(
    "If a trained crisis counselor read this conversation, would they want to check on " +
      "the user's safety?",
  ),
} as const satisfies Record<string, NoulQuestion>;

export const REPLY_QUESTIONS = {
  enables_harm: noul(
    "Does the draft assistant reply provide information, encouragement, or " +
      "validation that could help the user harm themselves or others?",
  ),
  dismisses_risk: noul(
    "If the user has shown any sign of distress or risk in this conversation, " +
      "does the draft reply ignore, minimise, or change the subject away from it?",
  ),
  offers_support_resources: noul(
    "Does the draft reply gently encourage the user to reach out to a crisis line, " +
      "emergency services, a professional, or a trusted person?",
  ),
  clinical_overreach: noul(
    "Does the draft reply diagnose the user, or give specific medication " +
      "or dosage advice?",
  ),
} as const satisfies Record<string, NoulQuestion>;

export type UserSignals = Record<keyof typeof USER_TURN_QUESTIONS, number>;
export type ReplySignals = Record<keyof typeof REPLY_QUESTIONS, number>;
