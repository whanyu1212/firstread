import { describe, expect, it } from "vitest";
import { Conversation, FirstRead } from "../src";
import { INTERNATIONAL, SINGAPORE, formatResources, resourcesFor } from "../src/resources";
import { DEFAULT_REPLIES, repliesFor } from "../src/templates";
import type { JevClient } from "../src/jev";

describe("resourcesFor", () => {
  it("finds Singapore by code or name, in any case", () => {
    expect(resourcesFor("SG")).toBe(SINGAPORE);
    expect(resourcesFor("sg")).toBe(SINGAPORE);
    expect(resourcesFor(" Singapore ")).toBe(SINGAPORE);
  });

  it("falls back to international for anywhere unverified", () => {
    expect(resourcesFor("US")).toBe(INTERNATIONAL);
    expect(resourcesFor(undefined)).toBe(INTERNATIONAL);
  });
});

describe("Singapore lines", () => {
  // Checked 2026-10-07 against sos.org.sg, mindline.sg and moh.gov.sg. If these change, re-verify
  // against the sources in resources.ts rather than editing the test to match.
  const text = formatResources(SINGAPORE);
  it.each(["1767", "9151 1767", "1771", "+65 6669 1771", "mindline.sg", "995 or 999"])("includes %s", (s) =>
    expect(text).toContain(s),
  );
  it("records where and when they were checked", () => {
    expect(SINGAPORE.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(SINGAPORE.sources.length).toBeGreaterThan(0);
  });
});

describe("replies", () => {
  it("repliesFor puts the country's lines in the safe and crisis replies", () => {
    const sg = repliesFor("SG");
    expect(sg.safe).toContain("1767");
    expect(sg.crisis).toContain("1767");
    expect(sg.safe).not.toContain("988");
    expect(sg.holding).toBe(DEFAULT_REPLIES.holding);
  });

  it("FirstRead sends the configured replies", async () => {
    // Every check flags CRISIS and approves the draft: the action is escalate.
    const client: JevClient = {
      async ask(_state, questions) {
        return Object.fromEntries(Object.keys(questions).map((k) => [k, k === "intent" ? 0.9 : 0.1])) as never;
      },
    };
    const sg = repliesFor("SG");
    const audit = await new FirstRead({ client, replies: sg }).audit(new Conversation(), "hi", "draft");
    expect(audit.reply).toBe(sg.crisis);
  });
});
