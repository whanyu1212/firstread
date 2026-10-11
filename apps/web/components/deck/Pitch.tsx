import Link from "next/link";
import { CRISIS_CUTOFFS, ELEVATED_CUTOFFS, WATCH_CUTOFFS, levelEvidence } from "firstread/policy";
import type { ReactNode } from "react";
import bhh from "@/slides/data/bhh.json";
import crisis from "@/slides/data/replay-crisis.json";
import { Glass } from "./Glass";
import { Harness } from "./Harness";
import { Iterations } from "./Iterations";

const turn = crisis.turns[0]!;
const crisisTurn = crisis.turns[1]!;
const evidence = levelEvidence(crisisTurn.data.audit.userSignals!);
const jev = bhh.runs.find((run) => run.id === "jev")!;
const glm = bhh.runs.find((run) => run.id === "glm")!;
const label = "text-fig font-medium text-muted";
const body = "text-xl leading-relaxed sm:text-2xl";
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

function Frame({ chapter, title, intro, children, note }: {
  chapter: string; title: string; intro?: ReactNode; children: ReactNode; note?: ReactNode;
}) {
  return (
    <div className="space-y-7 lg:space-y-8">
      <header>
        <p className={`${label} mb-4`}>FirstRead <span className="mx-3 text-accent">/</span> {chapter}</p>
        <h1 className="max-w-[28ch] text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl">{title}</h1>
        {intro && <p className="mt-5 max-w-[54em] text-xl leading-relaxed text-ink/80">{intro}</p>}
      </header>
      {children}
      {note && <p className="relative max-w-5xl text-fig leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

export function PitchIntervention() {
  return (
    <Frame chapter="The starting point" title="One conversation, two checks"
      intro="FirstRead reads the person’s message and the companion’s draft before delivery. This saved turn shows why checking the reply matters as well as detecting risk."
      note="A recorded synthetic turn. The draft is verbatim; the delivered reply is excerpted. ELEVATED is the system’s assessment, not a diagnosis. Whether this opener warrants that level is part of the evaluation problem.">
      <blockquote className="border-l-2 border-accent pl-5 text-2xl">“{turn.user}”</blockquote>
      <div className="grid gap-7 lg:grid-cols-[1.2fr_0.9fr_1fr]">
        <section className="border-t border-ink/20 pt-5">
          <h2 className={label}>The companion’s draft</h2>
          <blockquote className="mt-4 text-xl leading-relaxed">“{turn.draft}”</blockquote>
        </section>
        <section className="border-t-2 border-level-elevated pt-5">
          <h2 className={label}>The two checks</h2>
          <p className="mt-4 text-xl leading-relaxed">The user check reads <strong>ELEVATED</strong>. At that level, our policy requires support resources.</p>
          <p className="mt-4 text-xl leading-relaxed">The draft scores <strong>{turn.data.audit.replySignals!.offers_support_resources.toFixed(2)}</strong> for offering resources, below the 0.50 cutoff.</p>
        </section>
        <section className="border-t-2 border-accent pt-5">
          <h2 className={label}>The resulting action: replace</h2>
          <blockquote className="mt-4 text-xl leading-relaxed">“{turn.reply.split(". ")[0]}. …”</blockquote>
          <p className="mt-4 text-xl text-accent">The delivered reply includes configured support contacts.</p>
        </section>
      </div>
    </Frame>
  );
}

export function PitchRequirements() {
  const rows = [
    ["Latency", "The check sits in front of every reply.", "Read the user while the companion drafts. Check the reply before releasing it."],
    ["Cost", "Checking only a sample would leave turns unchecked.", "Use a small structured check on every turn; measure its cost separately from generation."],
    ["Useful scores", "A binary flag gives us little room to tune the policy.", "Ask specific questions, then choose cutoffs from measured recall and false alarms."],
  ];
  return (
    <Frame chapter="Design constraints" title="What checking every turn demands"
      intro="The check needs to fit the conversation, and its decisions need to be explainable when they are wrong."
      note="A score is not a clinical probability. Jev’s mid-range scores run low on this benchmark; we use them to rank evidence and tune cutoffs, rather than reading 0.3 as a 30% chance of harm.">
      <div className="divide-y divide-ink/15 border-y border-ink/15">
        {rows.map(([name, constraint, response]) => (
          <section key={name} className="grid gap-4 py-6 lg:grid-cols-[0.55fr_1fr_1.15fr] lg:gap-8">
            <h2 className="text-2xl font-semibold">{name}</h2>
            <p className="text-xl leading-relaxed">{constraint}</p>
            <p className="text-xl leading-relaxed text-muted">{response}</p>
          </section>
        ))}
      </div>
    </Frame>
  );
}

export function PitchComparison() {
  return (
    <Frame chapter="Choosing the judge" title="Why Jev, given those constraints?"
      intro="We asked five models the same user-risk questions. Jev had the highest AUC in this run; the closest alternative was GLM. Speed and cost help explain the choice."
      note="Between Help and Harm (BHH) test split: AUC uses 1,750 self-harm / no-risk messages; latency uses all 2,044 shared messages. Test labels are model-generated. Models use different scoring interfaces; full ROC curves and methodology are in the appendix.">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div className="overflow-x-auto">
          <table className="w-full text-lg tabular-nums">
            <caption className="mb-4 text-left text-fig text-muted">Single-message classification and observed median latency</caption>
            <thead><tr className="border-b border-ink/20 text-muted"><th className="pb-3 text-left font-normal" scope="col">Model</th><th className="pb-3 text-right font-normal" scope="col">AUC</th><th className="pb-3 pl-5 text-right font-normal" scope="col">Median check</th></tr></thead>
            <tbody>{[...bhh.runs].sort((a, b) => b.auc - a.auc).map((run) => (
              <tr key={run.id} className={`border-b border-ink/10 ${run.id === "jev" ? "font-semibold text-accent" : ""}`}>
                <th scope="row" className="py-3 pr-4 text-left font-medium">{run.name}</th>
                <td className="text-right">{run.auc.toFixed(3)}</td>
                <td className="py-3 pl-5"><div className="flex items-center justify-end gap-3"><span className="hidden h-1.5 w-24 bg-ink/5 sm:block" aria-hidden="true"><span className="block h-full bg-accent/65" style={{ width: `${run.latency.p50 / 8000 * 100}%` }} /></span><span className="w-16 text-right">{seconds(run.latency.p50)}</span></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="space-y-5 border-l-2 border-accent pl-6">
          <h2 className="text-2xl font-semibold">The close comparison</h2>
          <p className={body}>GLM reaches <strong>{glm.auc.toFixed(3)} AUC</strong>, against Jev’s {jev.auc.toFixed(3)}.</p>
          <p className="text-xl leading-relaxed">Its median check takes <strong>{(glm.latency.p50 / jev.latency.p50).toFixed(1)}× as long</strong>. Recorded cost estimates are $0.21 versus $0.04 per 1,000 user checks.</p>
          <p className="text-fig leading-relaxed text-muted">Those costs exclude the companion and reply check. Jev’s scores still need policy calibration; the comparison does not establish clinical reliability.</p>
        </div>
      </div>
    </Frame>
  );
}

export function PitchPolicy() {
  // Short paraphrases of questions.ts, with thresholds read from the actual policy.
  const questions = [
    ["ideation", "Do they express thoughts of dying or hurting themselves?"],
    ["self_harm", "Are they harming themselves, or feeling urges to do so?"],
    ["intent", "Do they intend to act on those thoughts?"],
    ["preparation", "Have they made preparations, such as goodbye letters?"],
    ["imminent", "Might they act soon, such as today or tonight?"],
  ] as const;
  const categories = [
    { name: "WATCH", rules: WATCH_CUTOFFS, color: "text-ink", background: "bg-level-watch/10" },
    { name: "ELEVATED", rules: ELEVATED_CUTOFFS, color: "text-ink", background: "bg-level-elevated/10" },
    { name: "CRISIS", rules: CRISIS_CUTOFFS, color: "text-level-crisis", background: "bg-level-crisis/10" },
  ];
  return (
    <Frame chapter="From answers to a category" title="From Jev’s questions to risk levels"
      intro={<>Jev answers <a href="https://github.com/whanyu1212/firstread/blob/main/packages/firstread/src/questions.ts" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">18 questions<span className="sr-only"> (source on GitHub, opens in a new tab)</span></a>: 14 about the user, 4 about the reply. The highest matching level wins.</>}
      note={<>Five of 14 user questions, shortened. “—”: no direct rule. NONE: no rule matches; earlier conversation risk can persist. <Link href="/deck/10" className="text-accent underline">More policy detail in the appendix</Link>. These are policy thresholds, not clinical probabilities.</>}>
      <blockquote className="border-l-2 border-accent pl-5 text-xl">Recorded message: “{crisisTurn.user}”</blockquote>
      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white/65">
        <table className="block w-full text-lg md:table">
          <caption className="block px-5 pt-4 pb-3 text-left text-fig text-muted md:table-caption">✓ = this recorded score meets the cutoff. Several levels can match; CRISIS takes precedence.</caption>
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-ink/15">
              <th scope="col" className="px-5 py-3 text-left font-medium">Question Jev answers</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Score</th>
              {categories.map((category) => <th key={category.name} scope="col" className={`px-5 py-3 text-center text-fig font-semibold ${category.background} ${category.color}`}>{category.name}</th>)}
            </tr>
          </thead>
          <tbody className="block md:table-row-group">{questions.map(([signal, question]) => {
            const score = crisisTurn.data.audit.userSignals![signal];
            return (
              <tr key={signal} className="grid grid-cols-3 border-b border-ink/10 last:border-0 md:table-row">
                <th scope="row" className="col-span-3 px-5 pt-4 pb-2 text-left font-normal leading-snug md:py-3">{question}</th>
                <td className="col-span-3 flex justify-between px-5 pt-0 pb-4 md:table-cell md:px-4 md:py-3 md:text-right"><span className="text-muted md:hidden">Recorded score</span><span className="font-mono">{score.toFixed(2)}</span></td>
                {categories.map((category) => {
                  const cutoff = category.rules.find(([key]) => key === signal)?.[1];
                  const met = cutoff !== undefined && score >= cutoff;
                  return <td key={category.name} className={`px-2 py-3 text-center font-mono whitespace-nowrap md:px-5 ${category.background} ${met ? `font-semibold ${category.color}` : "text-muted"}`}>
                    <span className="mb-1 block font-sans text-sm md:hidden">{category.name}</span>
                    {cutoff === undefined ? <span aria-label="No direct rule">—</span> : <><span aria-hidden="true">{met ? "✓ " : ""}</span><span className="sr-only">{met ? "Met: " : "Not met: "}</span>≥ {cutoff.toFixed(2)}</>}
                  </td>;
                })}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <p className="border-l-2 border-level-crisis pl-5 text-xl leading-relaxed"><strong>{evidence.level} → escalate.</strong> Stop generation, send the crisis reply, and emit a handoff event.</p>
    </Frame>
  );
}

export function PitchRuntime() {
  return (
    <Frame chapter="The runtime" title="Where the checks run"
      intro="The user check overlaps with generation. The reply check adds time after the draft is ready. This timeline uses the first recorded turn, not benchmark medians."
      note="If a check fails or misses the deadline, withhold the draft and use a fallback matched to known risk. That prevents unchecked delivery; it does not recover the missing assessment. Failed turns can be rechecked later.">
      <Glass><Harness at={0} draftAt={0} outcomesAt={0} deadlineAt={0} timelineOnly /></Glass>
    </Frame>
  );
}

export function PitchMemory() {
  return (
    <Frame chapter="Across turns" title="Why risk needs memory—and how it can get stuck"
      intro="A calm message should not erase an earlier disclosure. But remembering a mistaken assessment can also make later replies unnecessarily cautious."
      note="Current conversation evaluation: 37 synthetic conversations for development, 21 held out. In holdout, 5 conversations exceeded their labelled ceiling and 1 of 12 that should escalate was missed. These small sets expose failure patterns; they are not clinical validation.">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <section className="border-t-2 border-accent pt-5">
          <h2 className="text-2xl font-semibold">What persistence protects</h2>
          <p className="mt-5 text-xl leading-relaxed">A risk ledger carries concerning messages beyond the recent-message window. Weak signals can accumulate across turns.</p>
          <p className="mt-5 text-xl leading-relaxed">ELEVATED settles only after sustained calm and a low score. CRISIS requires explicit human clearance.</p>
        </section>
        <section className="border-t-2 border-level-elevated pt-5">
          <h2 className="text-2xl font-semibold">What persistence can amplify</h2>
          <p className="mt-5 text-xl leading-relaxed">A joke or concern about a friend can be read too severely. Once raised, the conversation’s level stays high by design.</p>
          <p className="mt-5 text-xl leading-relaxed font-medium">The next task is to reduce those initial misreadings and test recovery, while preserving sensitivity to real risk.</p>
        </section>
      </div>
    </Frame>
  );
}

export function PitchLearning() {
  return (
    <Frame chapter="The iteration loop" title="What improved, and what it cost"
      intro="Some misses involved weak signals that added up; others involved preparation without explicit intent. Adding questions and rules improved recall, while also increasing false alarms."
      note="Historical policy snapshots, rescored on saved BHH test runs. Recall at ELEVATED or above rose 7.9 percentage points; false alarms rose 2.0 points. A later fix inspected a test miss, so these figures predate that change.">
      <Glass><Iterations complete /></Glass>
    </Frame>
  );
}

export function PitchLimits() {
  return (
    <Frame chapter="The current boundary" title="What works, and what remains unresolved"
      intro="The demo lets us follow a turn from the draft through the checks, decision, and delivered reply. That makes the behavior inspectable; it does not establish that the judgments are reliable enough for deployment."
      note="The public demo is not a support service. It records escalation events but does not alert a staffed team. The questions and thresholds are not a validated clinical instrument.">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <section className="border-t border-ink/20 pt-5">
          <h2 className="text-2xl font-semibold">What we can demonstrate</h2>
          <ul className="mt-5 space-y-4 text-xl leading-relaxed"><li>A real draft replaced after a reply check.</li><li>A crisis turn stopping generation early.</li><li>Remembered risk and explicit outage handling.</li></ul>
          <Link href="/demo" target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-xl bg-ink px-5 py-3 text-lg font-medium text-white hover:bg-ink/80">Explore the recorded demo ↗<span className="sr-only"> (new tab)</span></Link>
        </section>
        <section className="border-t border-ink/20 pt-5">
          <h2 className="text-2xl font-semibold">What needs testing next</h2>
          <ul className="mt-5 space-y-4 text-xl leading-relaxed"><li><strong>Reply judgments:</strong> build an independent labelled evaluation.</li><li><strong>Conversation behavior:</strong> reduce over-escalation and test recovery.</li><li><strong>Human escalation:</strong> connect and evaluate an actual response workflow.</li></ul>
          <Link href="/deck/9" className="mt-6 inline-block text-lg text-accent hover:underline">Detailed evidence and policy appendix →</Link>
        </section>
      </div>
    </Frame>
  );
}
