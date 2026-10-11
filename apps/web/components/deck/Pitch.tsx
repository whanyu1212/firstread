import Link from "next/link";
import { CRISIS_CUTOFFS, ELEVATED_CUTOFFS, WATCH_CUTOFFS, levelEvidence } from "firstread/policy";
import type { ReactNode } from "react";
import bhh from "@/slides/data/bhh.json";
import crisis from "@/slides/data/replay-crisis.json";
import { Glass } from "./Glass";
import { Harness } from "./Harness";
import { Iterations } from "./Iterations";
import styles from "./DeckStyles.module.css";
import intervention from "./InterventionSlide.module.css";
import motivation from "./MotivationSlide.module.css";
import policy from "./PolicySlide.module.css";

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
    <div className={styles.frame}>
      <header className={styles.frameHeader}>
        <p className={styles.chapter}>FirstRead <span className="mx-3 text-accent">/</span> {chapter}</p>
        <h1 className={styles.title}>{title}</h1>
        {intro && <p className={styles.intro}>{intro}</p>}
      </header>
      {children}
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}

export function PitchMotivation() {
  return (
    <Frame chapter="Why this project" title="Why build a mental health companion?"
      intro="A concern about access in Singapore led us to a technical question about safety."
      note={<>An exploratory safety layer, not a therapy service or validated crisis detector. Singapore has subsidised care; costs vary. Context: <a href="https://www.moh.gov.sg/newsroom/assessing-out-of-pocket-costs-for-outpatient-mental-health-treatment-across-public-and-private-settings/" target="_blank" rel="noreferrer" className="text-accent underline">MOH: affordability<span className="sr-only"> (opens in a new tab)</span></a> · <a href="https://www.who.int/publications/i/item/9789241548205" target="_blank" rel="noreferrer" className="text-accent underline">WHO: psychological first aid<span className="sr-only"> (opens in a new tab)</span></a>.</>}>
      <div className={motivation.story}>
        <section className={motivation.origin}>
          <span className={motivation.label}>The motivation · Singapore</span>
          <h2>An easier place to start talking.</h2>
          <p>The cost of ongoing therapy made us ask whether a more accessible companion could offer everyday support and help people reach human care.</p>
          <p className={motivation.inspiration}>Psychological first aid informed the aim: humane, practical support, with a clear boundary around diagnosis and therapy.</p>
        </section>
        <ol className={motivation.reasoning}>
          <li><span aria-hidden="true">01</span><div><h2>Companionship brings responsibility</h2><p>We need to check both emerging risk in the conversation and the companion’s own replies.</p></div></li>
          <li><span aria-hidden="true">02</span><div><h2>Checks have to keep up</h2><p>Our concern was the latency of asking a general-purpose LLM to judge every turn.</p></div></li>
          <li><span aria-hidden="true">03</span><div><h2>Jev made this worth testing</h2><p>A user check took <strong>{seconds(jev.latency.p50)} median</strong> in our run, making frequent checks a practical experiment.</p></div></li>
        </ol>
      </div>
      <div className={motivation.question}><span>The FirstRead POC</span><p>Can we check for risk and unsafe replies on every turn, before delivery?</p></div>
    </Frame>
  );
}

export function PitchIntervention() {
  return (
    <Frame chapter="A recorded example" title="One conversation, two checks"
      intro="While the companion drafts, Jev checks the person’s message. It then checks the draft before anything is delivered."
      note="A recorded synthetic turn. The draft is verbatim; the delivered reply is excerpted. ELEVATED is the system’s assessment, not a diagnosis. Whether this opener warrants that level is part of the evaluation problem.">
      <div className={intervention.scene}>
        <div className={intervention.message}>
          <span className={intervention.eyebrow}>The person’s message</span>
          <blockquote>“{turn.user}”</blockquote>
        </div>
        <div className={intervention.fork} aria-hidden="true"><span>In parallel</span></div>
        <div className={intervention.paths}>
          <section className={intervention.draft}>
            <header><h2>The companion drafts</h2><span>Not yet delivered</span></header>
            <blockquote>“{turn.draft}”</blockquote>
            <p className={intervention.draftNote}>A supportive opener. But does it meet the policy for this turn?</p>
          </section>
          <div className={intervention.checks}>
            <section className={intervention.userCheck}>
              <h2><span>01</span> Jev reads the message</h2>
              <p><strong className={intervention.level}>ELEVATED</strong> <span>On this turn, policy requires support resources.</span></p>
            </section>
            <section className={intervention.replyCheck}>
              <span className={intervention.draftArrow} aria-hidden="true">→</span>
              <h2><span>02</span> Jev reads the draft</h2>
              <p>“Does the draft offer support resources?”</p>
              <div className={intervention.score}><strong>{turn.data.audit.replySignals!.offers_support_resources.toFixed(2)}</strong><span>P(yes) · must be <b>≥ 0.50</b></span></div>
              <p className={intervention.failed}>Required check failed → withhold this draft.</p>
            </section>
          </div>
        </div>
        <section className={intervention.delivery}>
          <div><span className={intervention.eyebrow}>Requirement unmet → replacement</span><h2>Send a reply with support resources</h2></div>
          <div><blockquote>“{turn.reply.split(". ")[0]}. …”</blockquote><p>The configured replacement includes support contacts. The original draft is not sent.</p></div>
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
      intro="For an accessible companion, the safety check must be fast, affordable on every turn, and inspectable when it is wrong."
      note="A score is not a clinical probability. Jev’s mid-range scores run low on this benchmark; we use them to rank evidence and tune cutoffs, rather than reading 0.3 as a 30% chance of harm.">
      <div className={styles.constraints}>
        {rows.map(([name, constraint, response]) => (
          <section key={name} className={styles.constraint}>
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
      <div className={styles.comparison}>
        <div className={styles.comparisonTable}>
          <table className="w-full text-lg tabular-nums">
            <caption className="mb-4 text-left text-fig text-muted">Single-message classification and observed median latency</caption>
            <thead><tr className="border-b border-ink/20 text-muted"><th className="pb-3 text-left font-normal" scope="col">Model</th><th className="pb-3 text-right font-normal" scope="col">AUC</th><th className="pb-3 pl-5 text-right font-normal" scope="col">Median check</th></tr></thead>
            <tbody>{[...bhh.runs].sort((a, b) => b.auc - a.auc).map((run) => (
              <tr key={run.id} className={run.id === "jev" ? styles.jevRow : undefined}>
                <th scope="row" className="py-3 pr-4 text-left font-medium">{run.name}</th>
                <td className="text-right">{run.auc.toFixed(3)}</td>
                <td className="py-3 pl-5"><div className="flex items-center justify-end gap-3"><span className="hidden h-1.5 w-24 bg-ink/5 sm:block" aria-hidden="true"><span className={styles.latencyBar} style={{ width: `${run.latency.p50 / 8000 * 100}%` }} /></span><span className="w-16 text-right">{seconds(run.latency.p50)}</span></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className={styles.insight}>
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
  const intentScore = crisisTurn.data.audit.userSignals!.intent;
  const intentCutoff = CRISIS_CUTOFFS.find(([signal]) => signal === "intent")![1];
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
      intro="A yes/no question gets a probability of “yes”, not just a binary answer. FirstRead’s rules turn those scores into a level."
      note={<>P(yes) is Jev’s answer probability, not the probability of harm. Five user questions shown; the full policy includes combined rules, and conversation history can retain a higher level. <a href="https://github.com/whanyu1212/firstread/blob/main/packages/firstread/src/questions.ts" target="_blank" rel="noreferrer" className="text-accent underline">All 18 questions (14 user, 4 reply)<span className="sr-only"> (source on GitHub, opens in a new tab)</span></a> · <Link href="/deck/11" className="text-accent underline">Full policy walkthrough</Link>.</>}>
      <div className={policy.content}>
        <div className={policy.example}>
          <p className={policy.message}>Recorded message: <span>“{crisisTurn.user}”</span></p>
          <div className={policy.chain}>
            <section><h2><span>1</span> Ask a yes/no question</h2><p>“Do they intend to act on those thoughts?”</p></section>
            <section><h2><span>2</span> Jev returns P(yes)</h2><p className={policy.answer}><strong>{intentScore.toFixed(2)}</strong><span>≈ {Math.round(intentScore * 100)}% “yes”<br />≈ {Math.round((1 - intentScore) * 100)}% “no”</span></p></section>
            <section><h2><span>3</span> Compare with a policy cutoff</h2><p className={policy.rule}>{intentScore.toFixed(2)} ≥ {intentCutoff.toFixed(2)} <span>→ CRISIS</span></p><p className={policy.explain}>This intent rule matches.</p></section>
          </div>
        </div>
      <div className={`${styles.policyTable} ${policy.table}`}>
        <table className="block w-full text-lg md:table">
          <caption className="block px-5 pt-4 pb-3 text-left text-fig text-muted md:table-caption">Each question has its own cutoffs. ✓ = score meets cutoff; — = no direct rule. These are not bands of one overall score.</caption>
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-ink/15">
              <th scope="col" className="px-5 py-3 text-left font-medium">Question Jev answers</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">P(yes)</th>
              {categories.map((category) => <th key={category.name} scope="col" className={`px-5 py-3 text-center text-fig font-semibold ${category.background} ${category.color}`}>{category.name}</th>)}
            </tr>
          </thead>
          <tbody className="block md:table-row-group">{questions.map(([signal, question]) => {
            const score = crisisTurn.data.audit.userSignals![signal];
            return (
              <tr key={signal} className={`${signal === "intent" ? policy.intentRow : ""} grid grid-cols-3 border-b border-ink/10 last:border-0 md:table-row`}>
                <th scope="row" className="col-span-3 px-5 pt-4 pb-2 text-left font-normal leading-snug md:py-3">{question}</th>
                <td className="col-span-3 flex justify-between px-5 pt-0 pb-4 md:table-cell md:px-4 md:py-3 md:text-right"><span className="text-muted md:hidden">Jev’s P(yes)</span><span className="font-mono">{score.toFixed(2)}</span></td>
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
        <div className={policy.result}>
          <div><p><strong>NONE</strong> if no policy rule matches.</p><p>Otherwise, take the highest match: <span className={policy.order}>WATCH <span aria-hidden="true">&lt;</span> ELEVATED <span aria-hidden="true">&lt;</span> CRISIS</span>.</p></div>
          <p className={policy.decision}>This turn: <strong>{evidence.level} → escalate</strong><span>Stop generation, send the crisis reply, emit a handoff event.</span></p>
        </div>
      </div>
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
      <div className={styles.duo}>
        <section className={styles.protect}>
          <h2 className="text-2xl font-semibold">What persistence protects</h2>
          <p className="mt-5 text-xl leading-relaxed">A risk ledger carries concerning messages beyond the recent-message window. Weak signals can accumulate across turns.</p>
          <p className="mt-5 text-xl leading-relaxed">ELEVATED settles only after sustained calm and a low score. CRISIS requires explicit human clearance.</p>
        </section>
        <section className={styles.caution}>
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
    <Frame chapter="Learning from missed cases" title="Catching more risk also raised false alarms"
      intro="Added questions and rules caught more risk, but also flagged more no-risk messages."
      note="BHH test: 519 risk and 1,231 no-risk messages; flagged at ELEVATED or above. Each saved run uses its commit’s policy. Three versions, not a threshold sweep. Results predate a later fix informed by a test miss.">
      <Glass><Iterations complete /></Glass>
    </Frame>
  );
}

export function PitchLimits() {
  return (
    <Frame chapter="The current boundary" title="What works, and what remains unresolved"
      intro="The demo lets us follow a turn from the draft through the checks, decision, and delivered reply. That makes the behavior inspectable; it does not establish that the judgments are reliable enough for deployment."
      note="The public demo is not a support service. It records escalation events but does not alert a staffed team. The questions and thresholds are not a validated clinical instrument.">
      <div className={styles.duo}>
        <section className={styles.demonstrate}>
          <h2 className="text-2xl font-semibold">What we can demonstrate</h2>
          <ul className="mt-5 space-y-4 text-xl leading-relaxed"><li>A real draft replaced after a reply check.</li><li>A crisis turn stopping generation early.</li><li>Remembered risk and explicit outage handling.</li></ul>
          <Link href="/demo" target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-xl bg-ink px-5 py-3 text-lg font-medium text-white hover:bg-ink/80">Explore the recorded demo ↗<span className="sr-only"> (new tab)</span></Link>
        </section>
        <section className={styles.unresolved}>
          <h2 className="text-2xl font-semibold">What needs testing next</h2>
          <ul className="mt-5 space-y-4 text-xl leading-relaxed"><li><strong>Reply judgments:</strong> build an independent labelled evaluation.</li><li><strong>Conversation behavior:</strong> reduce over-escalation and test recovery.</li><li><strong>Human escalation:</strong> connect and evaluate an actual response workflow.</li></ul>
          <Link href="/deck/10" className="mt-6 inline-block text-lg text-accent hover:underline">Detailed evidence and policy appendix →</Link>
        </section>
      </div>
    </Frame>
  );
}
