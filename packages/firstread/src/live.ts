/**
 * FirstRead's defaults for live turns. Kept apart from guard.ts, which loads Jev's SDK, so a page
 * that only shows these numbers (the deck) can import them.
 */

/** How many recent messages, user and assistant, Jev sees with each check. */
export const DEFAULT_WINDOW = 8;

/** How long both checks may take once the draft is ready, retries included, before failing closed. */
export const DEFAULT_DEADLINE_MS = 3_000;
