"use client";

import type { RiskLevel } from "firstread";
import type { ChatMessage } from "@/lib/chat";
import { assessmentUnavailable, draftChange } from "@/lib/margin";
import { CompanionReply, dataPart, messageText, UserBubble } from "./CompanionChat";
import { TurnNote } from "./Margin";

/** Presenter-only outcome: show the intervention first, and keep technical evidence opt-in. */
export function DemoTurn({ user, reply, index, before, busy, recorded, onInspect }: {
  user: ChatMessage;
  reply?: ChatMessage;
  index: number;
  before: RiskLevel | null;
  busy: boolean;
  recorded: boolean;
  onInspect: () => void;
}) {
  const audit = reply && dataPart(reply, "audit");
  const check = reply && dataPart(reply, "check");
  const risk = reply && dataPart(reply, "risk");
  const text = reply ? messageText(reply) : "";
  const complete = Boolean(audit && risk && text);
  const unavailable = assessmentUnavailable(check, audit);
  const changed = audit && audit.action !== "send";
  const title = !complete
    ? unavailable ? "Assessment unavailable" : busy ? "Checking before delivery…" : "Turn not completed"
    : unavailable ? "Assessment unavailable · draft held"
    : audit!.action === "escalate" ? "Crisis response sent"
    : changed ? "Draft replaced" : "Reply sent as written";
  const explanation = !complete
    ? unavailable ? "This is not a no-risk result. An unchecked draft will not be delivered."
      : busy ? "FirstRead reads the message and checks the draft before a reply appears."
      : "No completed assessment is available for this turn."
    : draftChange(audit!) ?? (audit!.shortCircuit === "already-crisis"
      ? "The conversation remains at CRISIS. The crisis response was sent without generating another draft."
      : audit!.action === "send" ? "The draft passed the policy checks and reached the user unchanged."
      : "FirstRead sent its policy response instead of the draft.");
  // Only synthetic fixture playback supplies this part; the live endpoint never sends rejected drafts.
  const draft = reply && dataPart(reply, "recordedDraft");

  return (
    <article className="border-b border-line px-4 py-6 last:border-0 sm:px-7" aria-label={`Turn ${index + 1}`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="font-mono">TURN {String(index + 1).padStart(2, "0")}</span>
        <span>User message</span>
      </div>
      <UserBubble text={messageText(user)} />
      <div className={`my-4 rounded-xl border px-4 py-3 ${unavailable ? "border-danger/25 bg-danger/[0.03]" : changed ? "border-accent/20 bg-accent/[0.04]" : "border-line bg-margin"}`} role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-semibold ${unavailable ? "text-danger" : "text-ink"}`}>{title}</p>
          {complete && risk && <span className="rounded-full border border-ink/10 bg-white px-2 py-0.5 font-mono text-xs">{unavailable ? "Retained: " : "Risk: "}{risk.level}</span>}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink/75">{explanation}</p>
        {complete && audit?.action === "escalate" && <p className="mt-1 text-xs text-muted">Escalation event emitted. No human is notified in this demo.</p>}
      </div>

      {complete && recorded && changed && draft && (
        <details className="group mb-4 rounded-xl border border-line bg-margin px-4 py-3" onToggle={(event) => { if (event.currentTarget.open) onInspect(); }}>
          <summary className="cursor-pointer text-sm font-medium">View intercepted draft <span className="font-normal text-muted">· never delivered</span></summary>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted">{draft.text}</p>
          <p className="mt-2 text-xs text-muted">Original output from this synthetic recording.</p>
        </details>
      )}
      {text && <p className="mb-2 text-xs font-medium text-muted">Delivered to the user</p>}
      <CompanionReply message={reply} pending={false} />

      {complete && (
        <details className="mt-4 text-sm" onToggle={(event) => { if (event.currentTarget.open) onInspect(); }}>
          <summary className="cursor-pointer text-accent">Inspect this turn <span className="text-muted">· signals & timing</span></summary>
          <div className="mt-3 rounded-xl border border-line bg-margin p-4">
            {recorded && changed && !draft && !audit?.shortCircuit && <p className="mb-3 text-xs text-muted">This older recording does not retain the original draft.</p>}
            <TurnNote reply={reply} before={before} />
          </div>
        </details>
      )}
    </article>
  );
}
