"use client";

import type { RiskLevel } from "firstread";
import type { LevelAnswer } from "firstread/policy";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import type { ChatData, ChatMessage } from "@/lib/chat";
import { handoffLine } from "@/lib/handoff";
import { draftChange, pct, why } from "@/lib/margin";
import { dataPart, secs } from "./CompanionChat";
import { LEVEL_COLOR, LEVEL_LABEL, LEVEL_MEANING, LEVEL_ORDER } from "./levels";

/**
 * FirstRead's side of the demo, for presenters and reviewers: a note in the margin beside each
 * turn, and the margin rule between them, coloured by the conversation's level after each turn.
 * Never shown to the person chatting in production: this belongs on the reviewer page (HY-20).
 */

/** Jev's questions about the user's message, in plain words. */
const USER_SIGNAL_LABELS: Record<string, string> = {
  ideation: "Thoughts of not wanting to live",
  self_harm: "Hurting themselves, or urges to",
  method_seeking: "Asking how to hurt themselves",
  plan: "Thought about how or when",
  means: "Has a way to do it",
  intent: "Intends to act",
  preparation: "Preparing, like goodbye letters",
  imminent: "May act soon",
  harm_to_others: "Wants to harm someone else",
  own_death_wish: "Their own wish to die",
  disguised_request: "A disguised request for methods",
  counselor_concern: "A counsellor would check in",
  asks_for_person: "Asking for a real person",
};

/** Jev's questions about the companion's draft. */
const REPLY_SIGNAL_LABELS: Record<string, string> = {
  offers_support_resources: "Points to support",
  dismisses_risk: "Moves past the distress",
  enables_harm: "Could enable harm",
  clinical_overreach: "Gives clinical advice",
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

/**
 * How to read the margin: the rule's colours, which colour is Jev, and, once a turn is done, how
 * much time FirstRead adds: the reply check (the user check runs while the companion writes).
 */
export function MarginKey({ addedMs }: { addedMs?: number | null }) {
  return (
    <div className="space-y-1.5 text-xs text-muted">
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Levels">
        {LEVEL_ORDER.map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} aria-hidden="true" />
            {LEVEL_LABEL[l]}
          </li>
        ))}
      </ul>
      <p>
        <span className="font-semibold text-accent">Blue is Jev.</span> Its answers are the chance the answer to a
        yes/no question is yes.
        {addedMs != null && ` It reads each message while the companion writes, so checking adds about ${secs(addedMs)}.`}
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

/** Jev's answers that set a reading, as the questions and the chance of yes. */
function Answers({ answers, combined }: { answers: LevelAnswer[]; combined: number | null }) {
  const rows: [string, number][] = [
    ...answers.map((a) => [USER_SIGNAL_LABELS[a.signal] ?? a.signal, a.value] as [string, number]),
    // No one weak answer was the reason, so show what they add up to.
    ...(combined !== null ? [["Small self-harm signals, together", combined] as [string, number]] : []),
  ];
  return (
    <figure>
      <figcaption className="mb-1 text-xs text-muted">What Jev saw in this message</figcaption>
      <ul className="space-y-1">
        {rows.map(([label, v]) => (
          <li key={label} className="grid grid-cols-[minmax(0,1fr)_3rem_2.5rem] items-center gap-2 text-sm">
            <span className="truncate" title={label}>
              {label}
            </span>
            <span className="h-1.5 rounded-full bg-line" aria-hidden="true">
              <span className="block h-full rounded-full bg-accent" style={{ width: pct(v) }} />
            </span>
            <span className="text-right font-mono text-xs text-muted">{pct(v)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * The note beside one turn: what FirstRead decided, and the strip showing what Jev did and when.
 * Jev's answers and the evidence fold under one toggle, so a note stays about as tall as its turn.
 * `compact` keeps the headline, the reply and the timing: for the deck, where the bars won't read.
 */
export function TurnNote({
  reply,
  before,
  compact = false,
  startedAt,
  live = false,
  elapsed,
}: {
  reply: ChatMessage | undefined;
  before: RiskLevel | null;
  compact?: boolean;
  /** When the user's message was sent, so the strip can run live while the turn is pending. */
  startedAt?: number;
  /** The turn is still in flight (not abandoned after an error). */
  live?: boolean;
  /** Seconds since the message, for a replay, whose clock isn't the wall clock. */
  elapsed?: () => number;
}) {
  const check = reply && dataPart(reply, "check");
  const audit = reply && dataPart(reply, "audit");
  const risk = reply && dataPart(reply, "risk");
  const timing = reply && dataPart(reply, "timing");

  if (!audit || !risk || !timing) {
    if (compact) {
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
    return (
      <div className="space-y-2.5" aria-live="polite">
        <p className="font-semibold tracking-tight">
          {check ? (check.ok ? `Read as ${LEVEL_LABEL[check.level]}` : "Couldn't read this message") : "Reading your message…"}
        </p>
        <JevStrip check={check} startedAt={startedAt} live={live} elapsed={elapsed} />
      </div>
    );
  }

  const { title, reason } = headline(risk, audit, before);
  const { answers, combined, note } = why(risk, audit, reason);
  const change = draftChange(audit);
  if (compact) {
    return (
      <div className="space-y-1">
        <p className="font-semibold tracking-tight">{title}</p>
        {/* A turn already at CRISIS is explained by its reply line. */}
        {audit.shortCircuit !== "already-crisis" && (
          <p className="text-muted">
            {answers.length > 0 ? answers.slice(0, 2).map((a) => `${USER_SIGNAL_LABELS[a.signal]} ${pct(a.value)}`).join(", ") : note}
          </p>
        )}
        <p>
          {replyLine(audit)} <span className="font-mono text-sm text-muted">{secs(timing.totalMs)}</span>
        </p>
      </div>
    );
  }
  const handoff = reply && dataPart(reply, "handoff");
  const exercise = reply && dataPart(reply, "exercise");
  const user = audit.userSignals;
  const userRows = user
    ? Object.entries(user)
        .filter(([k]) => k in USER_SIGNAL_LABELS)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [USER_SIGNAL_LABELS[k]!, v] as [string, number])
    : [];
  const replyRows = audit.replySignals
    ? Object.entries(audit.replySignals)
        .filter(([k]) => k in REPLY_SIGNAL_LABELS)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [REPLY_SIGNAL_LABELS[k]!, v] as [string, number])
    : [];

  // Three things, one line each: what happened, why, and what changed in the reply.
  return (
    <div className="space-y-2.5">
      <p className="flex items-start justify-between gap-3">
        <span className="font-semibold tracking-tight">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-muted" title="From the message to the reply on screen">
            {secs(timing.totalMs)}
          </span>
          <Decision audit={audit} />
        </span>
      </p>
      {answers.length > 0 && <Answers answers={answers} combined={combined} />}
      {note && <p className={`text-sm ${!audit.userSignals && !audit.shortCircuit ? "text-danger" : "text-muted"}`}>{note}</p>}
      {change && <p className="text-sm">{change}</p>}
      {(handoff || exercise) && (
        <ul className="space-y-1 text-sm">
          {handoff && <li>{handoffLine(handoff.reason)}</li>}
          {exercise && <li>Offered an exercise: {exercise.name}.</li>}
        </ul>
      )}

      {user && (
        <details className="text-sm">
          <summary className="cursor-pointer text-accent">
            Jev's {userRows.length + 1 + replyRows.length} answers, and the timing
          </summary>
          <div className="mt-2 space-y-3">
            <JevStrip check={check} audit={audit} timing={timing} />
            <Bars caption="This message" rows={[["Adds something new", user.latest_adds_risk], ...userRows]} />
            {replyRows.length > 0 && <Bars caption="The companion's draft" rows={replyRows} />}
            <Evidence score={risk.score} thresholds={risk.thresholds} />
          </div>
        </details>
      )}
    </div>
  );
}

/** The decision for the turn, as a badge: what the person was actually shown. */
function Decision({ audit }: { audit: ChatData["audit"] }) {
  const [label, style] =
    audit.failures.length > 0 && audit.action !== "escalate"
      ? ["Held back", "border border-danger text-danger"]
      : audit.action === "send"
        ? ["Sent", "border border-line bg-canvas text-ink"]
        : audit.action === "replace"
          ? ["Replaced", "bg-ink text-canvas"]
          : ["Crisis reply", "bg-danger text-white"];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

/**
 * Where one turn's time went, in two lanes: the companion writing its draft, and Jev reading the
 * message alongside it, then checking the draft. Real timings from the turn; while the turn is in
 * flight it runs live. Blue is Jev, as in the bars.
 */
export function JevStrip({
  check,
  audit,
  timing,
  startedAt,
  live = false,
  elapsed: elapsedOf,
}: {
  check: ChatData["check"] | undefined;
  audit?: ChatData["audit"];
  timing?: ChatData["timing"];
  startedAt?: number;
  live?: boolean;
  elapsed?: () => number;
}) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const done = Boolean(audit && timing);
  useEffect(() => {
    if (done || !live || reduce) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [done, live, reduce]);

  if (audit?.shortCircuit === "already-crisis") {
    return (
      <p className="text-sm text-muted">
        No checks this turn: the conversation is already at CRISIS, so the crisis reply went out at once.
      </p>
    );
  }

  const read = check ? check.ms / 1000 : timing?.checkMs != null ? timing.checkMs / 1000 : null;
  const readFailed = (check && !check.ok) || audit?.failures.some((f) => f.check === "user");
  const replyFailed = audit?.failures.some((f) => f.check === "reply") ?? false;
  const s = (sec: number) => `${sec.toFixed(1)}s`;

  let companion: Span;
  let jev: Span[];
  let axis: number;
  let sentence = "";
  if (audit && timing) {
    const total = timing.totalMs / 1000;
    const draft = timing.draftMs !== null ? timing.draftMs / 1000 : null;
    // Only a draft that was checked has a reply check: a failed or timed-out companion call still
    // has a draftMs (when it ended), but nothing was checked.
    const replyCheck = timing.replyCheckMs != null ? timing.replyCheckMs / 1000 : null;
    axis = total;
    if (audit.shortCircuit === "crisis") {
      const at = read ?? total;
      companion = { from: 0, to: at, stopped: true };
      jev = [{ from: 0, to: at }];
      sentence = `Jev read your message in ${s(at)} and found signs of crisis, so the companion was stopped and the crisis reply went out.`;
    } else if (draft === null || replyCheck === null) {
      companion = { from: 0, to: draft ?? total, stopped: true };
      jev = read !== null ? [{ from: 0, to: read, failed: readFailed }] : [];
      sentence = `The companion didn't reply, so FirstRead sent its own reply after ${s(total)}.`;
    } else {
      companion = { from: 0, to: draft };
      jev = [
        ...(read !== null ? [{ from: 0, to: read, failed: readFailed }] : []),
        { from: draft, to: draft + replyCheck, failed: replyFailed },
      ];
      sentence = readFailed
        ? `Jev didn't answer about your message in time, so the companion's reply was held back. Shown after ${s(total)}.`
        : replyFailed
          ? `Jev read your message in ${s(read ?? 0)} while the companion wrote, but didn't answer the reply check in time, so the reply was held back. Shown after ${s(total)}.`
          : `Jev read your message in ${s(read ?? 0)} while the companion wrote for ${s(draft)}, then checked the reply in ${s(replyCheck)}. Shown after ${s(total)}.`;
    }
  } else if (reduce) {
    // Nothing grows with reduced motion: the companion's lane is shown as still writing, and Jev's
    // read appears once it has answered.
    axis = Math.max(2 * (read ?? 0), 2);
    companion = { from: 0, to: axis, running: true };
    jev = read !== null ? [{ from: 0, to: read, failed: readFailed }] : [];
  } else {
    const elapsed = elapsedOf ? elapsedOf() : startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
    // Headroom past the elapsed time, so the companion's lane visibly advances and Jev's read stays
    // put; most turns take 3–6s. The scale snaps to the real total once the turn is done.
    axis = Math.max(6, elapsed + 1);
    companion = { from: 0, to: Math.max(elapsed, read ?? 0), running: true };
    jev = [read !== null ? { from: 0, to: read, failed: readFailed } : { from: 0, to: elapsed, running: true }];
  }
  if (!done) {
    sentence =
      read === null
        ? "Jev is reading your message while the companion writes."
        : readFailed
          ? "Jev didn't answer about your message in time. No unchecked reply will go out."
          : `Jev read your message in ${s(read)}. Next it checks the companion's reply before it's shown.`;
  }

  const pct = (sec: number) => `${Math.min(100, (100 * sec) / axis)}%`;
  return (
    <figure>
      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-xs" aria-hidden="true">
        <span className="text-muted">Companion</span>
        <Lane>
          <Segment span={companion} pct={pct} color="bg-ink/25" />
        </Lane>
        <span className="font-semibold text-accent">Jev</span>
        {jev.length > 0 && jev.every((j) => j.failed) ? (
          // Failed checks can fail fast (Jev down), too short to see as a segment.
          <span className="leading-none font-medium text-danger">No answer</span>
        ) : (
          <Lane>
            {jev.map((j, i) => (
              <Segment key={i} span={j} pct={pct} color="bg-accent" />
            ))}
          </Lane>
        )}
      </div>
      <figcaption className="mt-1.5 text-sm leading-snug text-muted">{sentence}</figcaption>
    </figure>
  );
}

type Span = { from: number; to: number; running?: boolean; stopped?: boolean; failed?: boolean };

function Lane({ children }: { children: ReactNode }) {
  return <span className="relative block h-2 rounded-full bg-line/70">{children}</span>;
}

function Segment({ span, pct, color }: { span: Span; pct: (sec: number) => string; color: string }) {
  const fill = span.failed
    ? "bg-[repeating-linear-gradient(135deg,var(--color-danger)_0_3px,transparent_3px_6px)]"
    : // Still running: faint, and pulsing unless motion is reduced.
      `${color} ${span.running ? "opacity-50 motion-safe:animate-node-wait" : ""}`;
  return (
    <span
      className={`absolute inset-y-0 rounded-full ${fill} ${span.stopped ? "rounded-r-none border-r-2 border-ink" : ""}`}
      style={{ left: pct(span.from), width: `max(4px, calc(${pct(span.to)} - ${pct(span.from)}))` }}
    />
  );
}

/** Jev's answers, the chance of yes, as bars. */
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
            <span className="text-right font-mono text-muted">{pct(v)}</span>
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
      <p className="mt-1.5 text-muted">
        FirstRead's own measure, not a probability. The ticks are where it raises the level: WATCH at{" "}
        {thresholds.watch.toFixed(1)}, ELEVATED at {thresholds.elevated.toFixed(1)}.
      </p>
    </div>
  );
}
