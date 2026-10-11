import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NowSummary } from "@/components/Margin";
import type { ChatData } from "@/lib/chat";

const failed: ChatData["check"] = { ok: false, reason: "error", ms: 0 };
const risk = (level: ChatData["risk"]["level"]): ChatData["risk"] => ({
  level, peak: level, score: 0, history: [], changes: [], ledger: [],
  thresholds: { watch: 0.9, elevated: 1 },
});

describe("conversation summary", () => {
  it("does not present a retained NONE as a result while a new assessment is pending", () => {
    for (const check of [undefined, { ok: true, level: "ELEVATED", ms: 400 }] as const) {
      const html = renderToStaticMarkup(createElement(NowSummary, { risk: risk("NONE"), check, pending: true, waiting: true }));
      expect(html).toContain("Assessment pending");
      expect(html).toContain("Retained conversation level:");
      expect(html).not.toContain("No sign of risk");
    }
  });

  it("shows an unavailable assessment before the first risk result arrives", () => {
    const html = renderToStaticMarkup(createElement(NowSummary, { risk: undefined, check: failed, waiting: true }));
    expect(html).toContain("Assessment unavailable");
    expect(html).not.toContain("No sign of risk");
    expect(html).not.toContain("once FirstRead has read");
  });

  it.each(["NONE", "WATCH", "ELEVATED", "CRISIS"] as const)("keeps %s visibly separate from an unavailable assessment", (level) => {
    const html = renderToStaticMarkup(createElement(NowSummary, { risk: risk(level), check: failed }));
    expect(html).toContain("Assessment unavailable");
    expect(html).toContain("Retained conversation level:");
    expect(html).toContain(level);
    expect(html).not.toContain("No sign of risk");
  });

  it("shows the normal summary again after a successful assessment", () => {
    const html = renderToStaticMarkup(createElement(NowSummary, { risk: risk("NONE"), check: { ok: true, level: "NONE", ms: 400 } }));
    expect(html).toContain("No sign of risk");
    expect(html).not.toContain("Assessment unavailable");
    expect(html).not.toContain("Retained conversation level:");
  });
});
