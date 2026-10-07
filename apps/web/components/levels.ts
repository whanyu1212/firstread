import type { RiskLevel } from "firstread";

/** Lowest to highest. Matches the library's RISK_LEVELS, without pulling its SDK into the page. */
export const LEVEL_ORDER: RiskLevel[] = ["NONE", "WATCH", "ELEVATED", "CRISIS"];

/** Colour per level. Always shown with the label: hue alone doesn't separate WATCH from ELEVATED. */
export const LEVEL_COLOR: Record<RiskLevel, string> = {
  NONE: "var(--color-level-none)",
  WATCH: "var(--color-level-watch)",
  ELEVATED: "var(--color-level-elevated)",
  CRISIS: "var(--color-level-crisis)",
};

/** The policy's own names, as the talk and the library's reasons use them. */
export const LEVEL_LABEL: Record<RiskLevel, string> = {
  NONE: "NONE",
  WATCH: "WATCH",
  ELEVATED: "ELEVATED",
  CRISIS: "CRISIS",
};

/** What each level means for the conversation, in a few words. */
export const LEVEL_MEANING: Record<RiskLevel, string> = {
  NONE: "No sign of risk.",
  WATCH: "Possible distress. Replies are checked more strictly.",
  ELEVATED: "Risk present. Replies must point to support.",
  CRISIS: "The crisis reply goes out, and a person would be alerted.",
};
