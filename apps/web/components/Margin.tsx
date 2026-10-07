"use client";

import type { RiskLevel } from "firstread";
import { useState } from "react";
import type { ChatData, ChatMessage } from "@/lib/chat";
import { dataPart, secs } from "./CompanionChat";
import { LEVEL_COLOR, LEVEL_LABEL, LEVEL_MEANING, LEVEL_ORDER } from "./levels";

/**
 * FirstRead's side of the demo, for presenters and reviewers: a note in the margin beside each
 * turn, and the margin rule between them, coloured by the conversation's level after each turn.
 * Never shown to the person chatting in production: this belongs on the reviewer page (HY-20).
 */

const USER_SIGNAL_LABELS: Record<string, string> = {
  ideation: "Thoughts of not wanting to live",
  self_harm: "Self-harm",
  method_seeking: "Asking about methods",
  plan: "A plan",
  means: "Access to means",
  intent: "Intent",
  preparation: "Preparation",
  imminent: "Acting soon",
  harm_to_others: "Harm to others",
  own_death_wish: "Their own wish to die",
  disguised_request: "Disguised request",
  counselor_concern: "A counsellor would check in",
  asks_for_person: "Asking for a person",
};

const REPLY_SIGNAL_LABELS: Record<string, string> = {
  offers_support_resources: "Points to support",
  dismisses_risk: "Dismisses the risk",
  enables_harm: "Could enable harm",
  clinical_overreach: "Clinical overreach",
};

/** Where the rule's dot sits in a row: level with the middle of a one-line user message. */
export const NODE_Y = "2.375rem";

/** The margin rule for one turn: the level before it above the dot, the level after it below. */
export function MarginRule({ before, after }: { before: RiskLevel | null; after: RiskLevel | null }) {
  return (
    <div className="relative h-full min-h-16" aria-hidden="true">
      {before && (
        <span className="absolute left-1/2 top-0 w-[3px] -translate-x-1/2" style={{ height: NODE_Y, background: LEVEL_COLOR[before] }} />
      )}
      {after ? (
        <span
          className="absolute bottom-0 left-1/2 w-[3px] -translate-x-1/2 origin-top motion-safe:animate-rule-draw"
          style={{ top: NODE_Y, background: LEVEL_COLOR[after] }}
        />
      ) : (
        <span
          className="absolute bottom-0 left-1/2 w-[3px] -translate-x-1/2"
          style={{ top: NODE_Y, background: "repeating-linear-gradient(to bottom, var(--color-line) 0 6px, transparent 6px 12px)" }}
        />
      )}
      <span
        className={`absolute left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-canvas lg:ring-margin ${after ? "" : "border-2 border-muted bg-canvas motion-safe:animate-node-wait"}`}
        style={{ top: NODE_Y, ...(after ? { background: LEVEL_COLOR[after] } : {}) }}
      />
    </div>
  );
}

/** The conversation's state now: the top of the margin. */
export function NowSummary({ risk, waiting = false }: { risk: ChatData["risk"] | undefined; waiting?: boolean }) {
  if (!risk && waiting) {
    return <p className="text-muted">The level appears once FirstRead has read the first message.</p>;
  }
  if (!risk) {
    return (
      <p className="text-muted">
        FirstRead reads each message while the companion writes, and each reply before it's shown. Its notes appear
        here, beside each turn.
      </p>
    );
  }
  return (
    <div>
      <p className="flex items-center gap-2.5">
        <span className="size-3.5 rounded-full" style={{ background: LEVEL_COLOR[risk.level] }} aria-hidden="true" />
        <span className="font-mono text-2xl leading-none font-semibold tracking-tight">{LEVEL_LABEL[risk.level]}</span>
        {risk.peak !== risk.level && (
          <span className="ml-auto text-sm text-muted">
            highest so far <span className="font-mono">{LEVEL_LABEL[risk.peak]}</span>
          </span>
        )}
      </p>
      <p className="mt-1.5 text-sm text-muted">{LEVEL_MEANING[risk.level]}</p>
      {risk.ledger.length > 0 && (
        <details className="group mt-3 text-sm">
          <summary className="cursor-pointer text-accent marker:content-none">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span> the{" "}
            {risk.ledger.length === 1 ? "message" : `${risk.ledger.length} messages`} FirstRead is carrying forward
          </summary>
          <ul className="mt-2 space-y-1.5">
            {risk.ledger.map((e) => (
              <li key={e.text} className="border-l-2 pl-2.5 text-muted" style={{ borderColor: LEVEL_COLOR[e.level] }}>
                “{e.text}”
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Kept so FirstRead still sees them once they leave its window.</p>
        </details>
      )}
    </div>
  );
}

/** How to read the margin: the rule's colours, the bars and the evidence line. */
export function MarginKey({ thresholds }: { thresholds: ChatData["risk"]["thresholds"] | undefined }) {
  return (
    <div className="space-y-2 text-xs text-muted">
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Levels">
        {LEVEL_ORDER.map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} aria-hidden="true" />
            {LEVEL_LABEL[l]}
          </li>
        ))}
      </ul>
      <p>
        Bars are Jev's answers, as probabilities. The evidence line is FirstRead's own measure, not a probability
        {thresholds
          ? `: its ticks are where it raises the level, to WATCH at ${thresholds.watch.toFixed(1)} and ELEVATED at ${thresholds.elevated.toFixed(1)}.`
          : "."}
      </p>
    </div>
  );
}

/** What changed this turn, as the headline of the note. */
function headline(risk: ChatData["risk"], audit: ChatData["audit"], before: RiskLevel | null) {
  // Without the user check there is no reading of this message, so never call it calm.
  if (!audit.userSignals && audit.shortCircuit !== "already-crisis") {
    return { title: "Couldn't read this message", reason: `The level stays at ${LEVEL_LABEL[risk.level]}.` };
  }
  const turn = risk.history.at(-1)?.turn;
  const change = risk.changes.find((c) => c.turn === turn);
  if (change) {
    const up = LEVEL_ORDER.indexOf(change.to) > LEVEL_ORDER.indexOf(change.from);
    return { title: `${up ? "Raised to" : "Settled to"} ${LEVEL_LABEL[change.to]}`, reason: change.reason };
  }
  if (risk.level === "NONE") return { title: "No sign of risk", reason: null };
  return { title: `${before === risk.level ? "Still" : "At"} ${LEVEL_LABEL[risk.level]}`, reason: null };
}

function replyLine(audit: ChatData["audit"]): string {
  if (audit.shortCircuit === "crisis") return "Stopped the companion and sent the crisis reply.";
  if (audit.shortCircuit === "already-crisis") return "Sent the crisis reply straight away: the conversation is at CRISIS.";
  if (audit.failures.length > 0 && audit.action !== "escalate") return "Held back the companion's reply and sent a cautious one.";
  if (audit.action === "send") return "Sent the companion's reply as written.";
  if (audit.action === "replace") return "Replaced the companion's reply with a safe one.";
  return "Sent the crisis reply.";
}

function timingLine(audit: ChatData["audit"], timing: ChatData["timing"]): string {
  if (audit.shortCircuit === "already-crisis") return `Replied in ${secs(timing.totalMs)}, with no checks needed.`;
  const read = audit.userSignals && timing.checkMs !== null ? `Read in ${secs(timing.checkMs)}. ` : "";
  return `${read}Reply shown after ${secs(timing.totalMs)}.`;
}

/** The note beside one turn. While the turn is pending, it shows how far FirstRead has got. */
export function TurnNote({ reply, before }: { reply: ChatMessage | undefined; before: RiskLevel | null }) {
  const [open, setOpen] = useState(false);
  const check = reply && dataPart(reply, "check");
  const audit = reply && dataPart(reply, "audit");
  const risk = reply && dataPart(reply, "risk");
  const timing = reply && dataPart(reply, "timing");

  if (!audit || !risk || !timing) {
    const read = check
      ? check.ok
        ? `Read your message: ${LEVEL_LABEL[check.level]}, in ${secs(check.ms)}.`
        : "Couldn't read your message in time. No unchecked reply will go out."
      : "Reading your message…";
    return (
      <div className="text-sm" aria-live="polite">
        <p className={check ? "font-medium" : "text-muted motion-safe:animate-node-wait"}>{read}</p>
        {check && <p className="mt-1 text-muted motion-safe:animate-node-wait">Checking the companion's reply before it's shown…</p>}
      </div>
    );
  }

  const { title, reason } = headline(risk, audit, before);
  const handoff = reply && dataPart(reply, "handoff");
  const exercise = reply && dataPart(reply, "exercise");
  const user = audit.userSignals;
  const topUser = user
    ? Object.entries(user)
        .filter(([k]) => k in USER_SIGNAL_LABELS)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
    : [];
  const replyRows = audit.replySignals
    ? Object.entries(audit.replySignals).filter(([k]) => k in REPLY_SIGNAL_LABELS).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-semibold tracking-tight">{title}</span>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="shrink-0 text-sm text-accent lg:hidden"
          >
            {open ? "Hide notes" : "Show notes"}
          </button>
        </p>
        {reason && <p className="mt-0.5 text-sm text-muted">{reason}</p>}
      </div>

      <div className={`space-y-3 ${open ? "" : "hidden"} lg:block`}>
        <p className="text-sm">{replyLine(audit)}</p>
        {audit.failures.length > 0 && (
          <p className="text-sm text-danger">
            The {audit.failures.map((f) => `${f.check} check (${f.reason})`).join(" and ")} didn't answer, so FirstRead
            failed closed.
          </p>
        )}

        {user && (
          <Bars
            rows={[
              ["This message adds", user.latest_adds_risk],
              ...topUser.map(([k, v]) => [USER_SIGNAL_LABELS[k]!, v] as [string, number]),
            ]}
          />
        )}
        {audit.action === "replace" && audit.failures.length === 0 && (
          <Bars caption="The reply check" rows={replyRows.map(([k, v]) => [REPLY_SIGNAL_LABELS[k]!, v])} />
        )}

        <Evidence score={risk.score} thresholds={risk.thresholds} />

        {(handoff || exercise) && (
          <ul className="space-y-1 text-sm">
            {handoff && <li>Recorded a request for a person: {handoff.reason.toLowerCase()}. No one is on call for the demo.</li>}
            {exercise && <li>Offered an exercise: {exercise.name}.</li>}
          </ul>
        )}

        <p className="font-mono text-xs text-muted">{timingLine(audit, timing)}</p>

        {(user || replyRows.length > 0) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-accent">All of Jev's answers</summary>
            <div className="mt-2 space-y-3">
              {user && (
                <Bars
                  caption="Your message"
                  rows={Object.entries(user)
                    .filter(([k]) => k in USER_SIGNAL_LABELS)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => [USER_SIGNAL_LABELS[k]!, v])}
                />
              )}
              {replyRows.length > 0 && (
                <Bars caption="The companion's reply" rows={replyRows.map(([k, v]) => [REPLY_SIGNAL_LABELS[k]!, v])} />
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/** Jev's answers, which are probabilities, as bars from 0 to 1. */
function Bars({ rows, caption }: { rows: [string, number][]; caption?: string }) {
  return (
    <figure>
      {caption && <figcaption className="mb-1 text-xs text-muted">{caption}</figcaption>}
      <ul className="space-y-1">
        {rows.map(([label, v]) => (
          <li key={label} className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.25rem] items-center gap-2 text-xs">
            <span className="truncate" title={label}>
              {label}
            </span>
            <span className="h-1.5 rounded-full bg-line" aria-hidden="true">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(v * 100)}%` }} />
            </span>
            <span className="text-right font-mono text-muted">{v.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * Risk evidence built up over the conversation, against where it raises the level on its own. A
 * policy measure, not a probability, so it gets a different mark from Jev's bars.
 */
function Evidence({ score, thresholds }: { score: number; thresholds: ChatData["risk"]["thresholds"] }) {
  const max = Math.max(thresholds.elevated * 1.5, score);
  const at = (v: number) => `${(100 * v) / max}%`;
  return (
    <div className="text-xs">
      <p className="mb-1.5 flex justify-between gap-2">
        <span>Evidence built up over the conversation</span>
        <span className="font-mono text-muted">{score.toFixed(2)}</span>
      </p>
      <div className="relative h-2.5" role="img" aria-label={`Risk evidence ${score.toFixed(2)}. It raises the level to WATCH at ${thresholds.watch} and ELEVATED at ${thresholds.elevated}.`}>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <span className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-ink/70" style={{ width: at(score) }} />
        {[thresholds.watch, thresholds.elevated].map((t) => (
          <span key={t} className="absolute top-0 h-full w-px bg-muted" style={{ left: at(t) }} />
        ))}
      </div>
    </div>
  );
}
