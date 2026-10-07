/**
 * Crisis and support lines, by country. No SDK imports, so the browser can use this too
 * (`firstread/resources`): the demo page shows these lines at all times.
 *
 * Every entry is copied from the organisation's own site or the national health ministry, with
 * the date it was checked. Re-check before relying on them; a wrong crisis number is the worst
 * bug this project could ship. Anywhere not listed falls back to findahelpline.com.
 */

export interface SupportLine {
  name: string;
  /** How to reach it, exactly as the source gives it. */
  contact: string;
  hours: string;
  /** What it's for, in a few words. */
  for: string;
}

export interface SupportResources {
  /** ISO 3166-1 alpha-2 code, or "INTL" for the fallback. */
  country: string;
  countryName: string;
  emergency: string;
  lines: SupportLine[];
  /** YYYY-MM-DD, and where each detail was checked. */
  checked: string;
  sources: string[];
}

export const SINGAPORE: SupportResources = {
  country: "SG",
  countryName: "Singapore",
  emergency: "995 or 999",
  lines: [
    {
      name: "Samaritans of Singapore (SOS)",
      contact: "call 1767, or WhatsApp CareText at 9151 1767",
      hours: "24 hours",
      for: "anyone in crisis or having thoughts of suicide",
    },
    {
      name: "National Mindline",
      contact: "call 1771, WhatsApp +65 6669 1771, or webchat at mindline.sg",
      hours: "24 hours",
      for: "mental health support by call, text or chat",
    },
  ],
  checked: "2026-10-07",
  sources: [
    "https://www.sos.org.sg/",
    "https://www.mindline.sg/",
    "https://www.moh.gov.sg/seeking-healthcare/find-a-facility-or-service/mental-health-services/",
  ],
};

/** Used for any country without a verified entry. */
export const INTERNATIONAL: SupportResources = {
  country: "INTL",
  countryName: "your country",
  emergency: "your local emergency number",
  lines: [
    {
      name: "Find A Helpline",
      contact: "findahelpline.com",
      hours: "lists lines and their hours",
      for: "free, confidential crisis lines in your country",
    },
  ],
  checked: "2026-10-07",
  sources: ["https://findahelpline.com/"],
};

const BY_COUNTRY: Record<string, SupportResources> = { SG: SINGAPORE };

/** Resources for a country code or name ("SG", "Singapore"); the international fallback otherwise. */
export function resourcesFor(country?: string): SupportResources {
  const key = (country ?? "").trim().toUpperCase();
  if (BY_COUNTRY[key]) return BY_COUNTRY[key];
  const byName = Object.values(BY_COUNTRY).find((r) => r.countryName.toUpperCase() === key);
  return byName ?? INTERNATIONAL;
}

/** One sentence per line, then emergency services. Used in the fallback replies. */
export function formatResources(r: SupportResources): string {
  const lines = r.lines.map((l) => `${l.name}: ${l.contact} (${l.hours}).`).join(" ");
  return `${lines} If you're in immediate danger, please call ${r.emergency}.`;
}
