import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoTurn } from "@/components/DemoTurn";
import { DemoNotice } from "@/components/DemoNotice";
import type { ChatMessage } from "@/lib/chat";
import { RECORDINGS } from "@/lib/recordings";
import { replyMessage, userMessage } from "@/lib/replay";

const turn = RECORDINGS.crisis!.turns[0]!;
const render = (reply: ChatMessage, recorded = true, busy = false) => renderToStaticMarkup(createElement(DemoTurn, {
  user: userMessage(turn, 0), reply, index: 0, before: null, recorded, busy, onInspect: () => {},
}));

describe("demo turn outcomes", () => {
  it("keeps support contacts outside the collapsed privacy disclosure", () => {
    const html = renderToStaticMarkup(createElement(DemoNotice));
    const visibleNotice = html.split("<details")[0]!;
    expect(visibleNotice).toContain("1767");
    expect(visibleNotice).toContain("1771");
    expect(visibleNotice).toContain("995 or 999");
    expect(html).toContain("Recorded scenarios play locally");
  });
  it("does not claim delivery when audit and risk arrive before the reply text", () => {
    const reply = replyMessage(turn, 0, "done");
    reply.parts = reply.parts.filter((part) => part.type !== "text");
    const html = render(reply, true, true);
    expect(html).toContain("Checking before delivery");
    expect(html).not.toContain("Draft replaced");
    expect(html).not.toContain("Delivered to the user");
    expect(html).not.toContain("View intercepted draft");
  });

  it("shows a genuine recorded draft only in recorded mode", () => {
    const reply = replyMessage({ ...turn, draft: "Synthetic draft unique to this test." }, 0, "done");
    expect(render(reply)).toContain("Synthetic draft unique to this test.");
    expect(render(reply, false)).not.toContain("Synthetic draft unique to this test.");
  });

  it("explains a missing original draft without inventing one", () => {
    const { draft, ...older } = turn;
    expect(render(replyMessage(older, 0, "done"))).toContain("This older recording does not retain the original draft.");
  });

  it("keeps a failed assessment separate from the retained risk level", () => {
    const reply = replyMessage(turn, 0, "done");
    reply.parts = reply.parts.map((part) => part.type === "data-check"
      ? { type: "data-check", data: { ok: false, reason: "error", ms: 0 } }
      : part.type === "data-audit"
        ? { ...part, data: { ...part.data, userSignals: null, failures: [{ check: "user", reason: "error" }] } }
        : part);
    const html = render(reply);
    expect(html).toContain("Assessment unavailable · draft held");
    expect(html).toContain("Retained: ");
    expect(html).not.toContain("Reply sent as written");
  });

  it("makes the simulated escalation boundary explicit", () => {
    const html = render(replyMessage(RECORDINGS.crisis!.turns[1]!, 1, "done"));
    expect(html).toContain("Crisis response sent");
    expect(html).toContain("No human is notified in this demo.");
    expect(html).not.toContain("View intercepted draft");
  });
});
