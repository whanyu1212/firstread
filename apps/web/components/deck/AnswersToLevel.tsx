"use client";

import type { UserSignals } from "firstread";
import { DEFAULT_WINDOW } from "firstread/live";
import { DEFAULT_RISK_CONFIG } from "firstread/risk";
import { motion } from "motion/react";
import type { ChatData } from "@/lib/chat";
import { LADDER_TURN, type LadderRule, ladder } from "@/lib/ladder";
import { pct } from "@/lib/margin";
import { LEVEL_COLOR, LEVEL_LABEL } from "../levels";
import { USER_SIGNAL_GROUPS, USER_SIGNAL_LABELS } from "../signals";
import { DURATION, useTransition } from "./motion";
import { Build, useStep } from "./steps";

/**
 * Act 2's first slide: how one message becomes a level. Step 1, Jev's answers; step 2, the rules
 * in policy.ts, with the ones this message met lit (lib/ladder.ts, from levelEvidence); step 3,
 * what the conversation adds. Every number is from the recording, policy.ts or the risk config.
 */
const turn = LADDER_TURN;
const signals = turn.data.audit!.userSignals!;
const check = turn.data.check as Extract<ChatData["check"], { ok: true }>;
const { level, rules } = ladder(signals);
const reason = turn.data.risk!.changes.at(-1)!.reason;
const LEVELS = ["CRISIS", "ELEVATED", "WATCH"] as const;
const C = DEFAULT_RISK_CONFIG;

export function AnswersToLevel() {
  return (
    <figure className="space-y-5">
      <p className="ml-auto w-fit max-w-[90%] rounded-xl bg-user px-4 py-2.5 text-lg">{turn.user}</p>
      <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
        <Build at={1} until={2}>
          <Answers />
        </Build>
        <Build at={2} until={3}>
          <Ladder />
        </Build>
        <Build at={3}>
          <Conversation />
        </Build>
      </div>
    </figure>
  );
}

function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <p className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-xl font-semibold tracking-tight">{title}</span>
      <span className="font-mono text-sm text-muted">{detail}</span>
    </p>
  );
}

/** Step 1: every answer from the one call, grouped as the demo's turn notes group them. */
function Answers() {
  const step = useStep();
  const t = useTransition();
  const count = Object.keys(signals).length;
  const columns = [USER_SIGNAL_GROUPS.slice(0, 2), USER_SIGNAL_GROUPS.slice(2)];
  return (
    <div>
      <Heading title="Jev's answers" detail={`${count} questions, one call, ${(check.ms / 1000).toFixed(2)}s`} />
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {columns.map((groups, c) => (
          <div key={c} className="space-y-4">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="mb-1.5 text-sm text-muted">{g.title}</p>
                <ul className="space-y-1.5">
                  {g.keys.map((k, i) => (
                    <li key={k} className="grid grid-cols-[minmax(0,1fr)_3rem_2.75rem] items-center gap-2 text-base leading-tight">
                      <span>{USER_SIGNAL_LABELS[k]}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                        <motion.span
                          className="block h-full origin-left rounded-full bg-accent"
                          style={{ width: pct(signals[k]) }}
                          initial={false}
                          animate={{ scaleX: step >= 1 ? 1 : 0 }}
                          transition={step >= 1 ? t(DURATION.base, 0.15 + i * 0.05 + c * 0.1) : t(0)}
                        />
                      </span>
                      <span className="text-right font-mono text-sm text-muted">{pct(signals[k])}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 text-base text-muted">The chance Jev gives each question a yes. No level yet: that's the rules' job.</p>
    </div>
  );
}

const label = (k: keyof UserSignals) => USER_SIGNAL_LABELS[k];
const atLeast = (cutoff: number) => `≥ ${pct(cutoff)}`;

function ruleText(r: LadderRule): string {
  if (r.combined) return `Small signals together ${atLeast(r.combined.cutoff)}, and a follow-up ${atLeast(r.parts[0]!.cutoff)}`;
  if (r.parts.length > 1) return `${r.parts.map((p) => label(p.signal)).join(" + ")}, each ${atLeast(r.parts[0]!.cutoff)}`;
  return `${label(r.parts[0]!.signal)} ${atLeast(r.parts[0]!.cutoff)}`;
}

function ruleValue(r: LadderRule): string {
  if (r.combined) return `${pct(r.combined.value)} · ${pct(Math.max(...r.parts.map((p) => p.value)))}`;
  return r.parts.map((p) => pct(p.value)).join(" · ");
}

/** Step 2: a few of each level's rules, highest level first, with this message's rules lit. */
function Ladder() {
  const step = useStep();
  const t = useTransition();
  let lit = 0;
  return (
    <div>
      <Heading title="The rules" detail="policy.ts" />
      <div className="space-y-3">
        {LEVELS.map((l) => (
          <div key={l}>
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-wide">
              <span className="size-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} aria-hidden="true" />
              {LEVEL_LABEL[l]}
            </p>
            <ul className="space-y-1">
              {rules
                .filter((r) => r.level === l)
                .map((r) => {
                  const delay = r.lit ? 0.4 + lit++ * 0.12 : 0;
                  return (
                    <li key={ruleText(r)} className="relative grid grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-3 rounded-lg px-3 py-1.5 text-base">
                      {r.lit && (
                        <motion.span
                          className="absolute inset-0 rounded-lg"
                          style={{ background: `color-mix(in srgb, ${LEVEL_COLOR[l]} 16%, transparent)`, boxShadow: `inset 3px 0 0 ${LEVEL_COLOR[l]}` }}
                          initial={false}
                          animate={{ opacity: step >= 2 ? 1 : 0 }}
                          transition={step >= 2 ? t(DURATION.base, delay) : t(0)}
                          aria-hidden="true"
                        />
                      )}
                      <span className={`relative ${r.lit ? "font-medium" : ""}`}>{ruleText(r)}</span>
                      <span className="relative font-mono text-sm text-muted">{ruleValue(r)}</span>
                      <span className="relative text-center text-sm" aria-label={r.met ? "met" : "not met"}>
                        {r.met ? "✓" : ""}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-base">
        The highest level with a rule met wins: <strong className="font-semibold">{LEVEL_LABEL[level]}</strong>.{" "}
        <span className="text-muted">Recorded reason: {reason}.</span>
      </p>
    </div>
  );
}

/** Step 3: what the conversation's level adds over one message's reading (risk.ts). */
function Conversation() {
  const levels = (turn.data.risk!.history ?? []).map((h) => h.level);
  const facts = [
    { title: "It rises at once and comes down slowly.", detail: "One calm message never lowers it." },
    {
      title: "Weak signals build up over turns.",
      detail: `Each message adds to a score that keeps ${pct(C.decay)} of itself per turn. ${C.scoreWatch} makes WATCH, ${C.scoreElevated} ELEVATED.`,
    },
    { title: `ELEVATED settles to WATCH after ${C.settleAfter} calm turns`, detail: "in a row. Never to NONE." },
    { title: "Only a person clears CRISIS.", detail: "A reviewer brings it down to ELEVATED, not lower." },
    {
      title: "Early messages are remembered.",
      detail: `Jev sees the last ${DEFAULT_WINDOW} messages. Up to ${C.ledgerMax} that raised concern are shown to it after they scroll out.`,
    },
  ];
  return (
    <div>
      <Heading title="The conversation" detail="risk.ts" />
      {levels.length > 0 && (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-muted">This recording so far:</span>
          {levels.map((l, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted" aria-hidden="true">→</span>}
              <span className="size-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} aria-hidden="true" />
              {LEVEL_LABEL[l]}
            </span>
          ))}
        </p>
      )}
      <ul className="space-y-3">
        {facts.map((f) => (
          <li key={f.title} className="text-base leading-snug">
            <strong className="font-semibold">{f.title}</strong> <span className="text-ink/75">{f.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
