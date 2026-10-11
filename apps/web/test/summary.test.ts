import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DemoClient } from "@/components/DemoClient";
import { NowSummary } from "@/components/Margin";
import type { ChatData, ChatMessage } from "@/lib/chat";
import { RECORDINGS } from "@/lib/recordings";

const chat = vi.hoisted(() => ({ messages: [] as ChatMessage[], busy: true }));
vi.mock("@/components/useCompanionChat", () => ({ useCompanionChat: () => chat }));

const failed: ChatData["check"] = { ok: false, reason: "error", ms: 0 };
const risk = (level: ChatData["risk"]["level"]): ChatData["risk"] => ({
  level, peak: level, score: 0, history: [], changes: [], ledger: [],
  thresholds: { watch: 0.9, elevated: 1 },
});

describe("conversation summary", () => {
  it("waits for the latest turn's risk part when its audit arrives before its risk", () => {
    const turn = RECORDINGS.crisis!.turns[1]!;
    const reply: ChatMessage = {
      id: "current-reply", role: "assistant", parts: [
        { type: "data-check", data: turn.data.check! },
        { type: "data-audit", data: turn.data.audit! },
      ],
    };
    chat.messages = [
      { id: "previous-user", role: "user", parts: [{ type: "text", text: "A calm message" }] },
      { id: "previous-reply", role: "assistant", parts: [{ type: "data-risk", data: risk("NONE") }] },
      { id: "current-user", role: "user", parts: [{ type: "text", text: turn.user }] },
      reply,
    ];
    const header = () => renderToStaticMarkup(createElement(DemoClient, { serverKey: true })).match(/<header\b[^>]*>([\s\S]*?)<\/header>/)![1]!;

    // An old risk part exists and the new audit succeeded, but the new risk is still in flight.
    const pending = header();
    expect(pending).toContain("Assessment pending");
    expect(pending).toContain("Retained conversation level:");
    expect(pending).toContain("NONE");
    expect(pending).not.toContain("No sign of risk");

    // Risk arrives before the rest of the response finishes streaming.
    reply.parts.push({ type: "data-risk", data: turn.data.risk! });
    const complete = header();
    expect(complete).toContain("CRISIS");
    expect(complete).not.toContain("Assessment pending");
    expect(complete).not.toContain("Retained conversation level:");
    expect(complete).not.toContain("No sign of risk");
  });

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
