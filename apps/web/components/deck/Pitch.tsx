import Link from "next/link";
import type { ReactNode } from "react";
import crisis from "@/slides/data/replay-crisis.json";

const turn = crisis.turns[0]!;
const label = "text-fig font-medium uppercase tracking-[0.12em] text-muted";
const body = "text-xl leading-relaxed sm:text-2xl";

function Frame({ chapter, title, children, note }: { chapter: string; title: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="space-y-8 lg:space-y-10">
      <header>
        <p className={`${label} mb-5`}>FirstRead <span className="mx-3 text-accent">/</span> {chapter}</p>
        <h1 className="max-w-[22ch] text-4xl leading-[1.06] font-semibold tracking-[-0.035em] sm:text-6xl lg:text-7xl">{title}</h1>
      </header>
      {children}
      {note && <p className="max-w-5xl text-fig leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

export function PitchProblem() {
  return (
    <Frame chapter="The problem" title={<>A caring reply can still<br className="max-sm:hidden" /> miss a safety obligation.</>} note="FirstRead is a safety layer for AI companions, powered by Jev. It checks the conversation and the draft before a reply reaches the user.">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <blockquote className="border-l-4 border-accent py-3 pl-7">
          <p className={`${label} mb-4`}>A message from the recorded demo</p>
          <p className="text-3xl leading-snug sm:text-4xl">“{turn.user}”</p>
        </blockquote>
        <div className="border-t border-ink/15 pt-5">
          <p className={body}>The companion responds with empathy.</p>
          <p className={`${body} mt-3 font-semibold`}>But at elevated risk, our policy also requires support resources.</p>
          <p className="mt-5 text-xl text-muted">Who checks that before the reply is sent?</p>
        </div>
      </div>
    </Frame>
  );
}

export function PitchIntervention() {
  return (
    <Frame chapter="The intervention" title="See the reply FirstRead changed." note="A saved synthetic run, not a live request. The draft is verbatim; the delivered reply is excerpted. ELEVATED is this run’s policy assessment, not a diagnosis.">
      <p className="text-xl text-muted">User: <span className="text-ink">“{turn.user}”</span></p>
      <div className="grid gap-7 lg:grid-cols-[1.2fr_0.85fr_1fr]">
        <section className="border-t-2 border-ink/20 pt-5">
          <h2 className={label}>01 / Companion draft</h2>
          <blockquote className="mt-5 text-xl leading-relaxed">“{turn.draft}”</blockquote>
        </section>
        <section className="border-t-2 border-level-elevated pt-5">
          <h2 className={label}>02 / FirstRead decision</h2>
          <p className="mt-5 text-3xl font-semibold">Replace</p>
          <p className="mt-3 text-xl leading-relaxed">Elevated risk.<br />Support resources missing.</p>
          <p className="mt-5 text-fig text-muted">The draft stays private.</p>
        </section>
        <section className="border-t-2 border-accent pt-5">
          <h2 className={label}>03 / Delivered reply</h2>
          <blockquote className="mt-5 text-xl leading-relaxed">“{turn.reply.split(". ")[0]}. …”</blockquote>
          <p className="mt-4 text-xl font-medium text-accent">+ configured support contacts</p>
        </section>
      </div>
      <Link href="/demo" target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-ink px-6 py-3 text-lg font-medium text-white hover:bg-ink/80">Open recorded demo ↗<span className="sr-only"> (new tab)</span></Link>
    </Frame>
  );
}

export function PitchArchitecture() {
  return (
    <Frame chapter="Why Jev" title="Small, structured checks. A decision before delivery." note="Jev scores 14 user-risk questions in one call. A second call checks the draft. The application’s policy chooses the action; Jev does not generate the companion’s reply.">
      <div className="grid items-stretch gap-6 lg:grid-cols-[1.2fr_auto_1fr_auto_0.8fr]">
        <div className="space-y-4">
          <p className={label}>Run in parallel</p>
          <div className="rounded-2xl border border-ink/10 bg-white/60 p-5"><p className="text-2xl font-semibold">Companion writes</p><p className="mt-2 text-xl text-muted">Draft held back from the user</p></div>
          <div className="rounded-2xl border border-accent/25 bg-accent/5 p-5"><p className="text-2xl font-semibold text-accent">Jev reads the risk</p><p className="mt-2 text-xl text-muted">Structured yes/no scores</p></div>
        </div>
        <span className="self-center text-3xl text-muted max-lg:hidden" aria-hidden="true">→</span>
        <div className="self-center border-l-2 border-accent py-4 pl-6"><p className={label}>Before delivery</p><h2 className="mt-4 text-3xl font-semibold">Check the draft.<br />Apply the policy.</h2><p className="mt-4 text-xl text-muted">Risk + reply obligations</p></div>
        <span className="self-center text-3xl text-muted max-lg:hidden" aria-hidden="true">→</span>
        <ul className="space-y-4 self-center text-2xl font-medium"><li>Send</li><li>Replace</li><li>Escalate</li></ul>
      </div>
      <p className={body}><strong className="text-accent">CRISIS takes the fast path:</strong> stop generation and deliver the crisis reply.</p>
    </Frame>
  );
}

export function PitchContinuity() {
  return (
    <Frame chapter="Beyond one message" title="Risk persists. Missing checks never mean “safe”." note="Implemented policy behavior. ELEVATED can settle to WATCH after several calm turns; CRISIS requires explicit human clearance. The POC emits escalation events but does not contact a staffed response team.">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <section className="border-t border-ink/20 pt-6">
          <h2 className="text-2xl font-semibold">Remember the conversation</h2>
          <div className="my-7 flex flex-wrap items-center gap-4 text-lg"><span className="rounded-full bg-level-elevated/15 px-4 py-2">Elevated risk</span><span aria-hidden="true">→</span><span>One calm message</span></div>
          <p className="text-3xl font-semibold">Risk stays elevated.</p>
          <p className="mt-4 text-xl leading-relaxed text-muted">A risk ledger carries earlier evidence forward. One reassuring turn cannot erase it.</p>
        </section>
        <section className="border-t border-ink/20 pt-6">
          <h2 className="text-2xl font-semibold">Handle a missing assessment</h2>
          <div className="my-7 flex flex-wrap items-center gap-4 text-lg"><span className="rounded-full bg-ink/5 px-4 py-2">Jev unavailable</span><span aria-hidden="true">→</span><span>Draft withheld</span></div>
          <p className="text-3xl font-semibold">Deliver a fallback reply.</p>
          <p className="mt-4 text-xl leading-relaxed text-muted">Use the risk already known, mark the failed check, and preserve the turn for re-checking.</p>
        </section>
      </div>
    </Frame>
  );
}

export function PitchEvidence() {
  return (
    <Frame chapter="The evidence" title="Strong single-message results. Clear limits." note="Between Help and Harm (BHH) test split. AUC: 1,750 self-harm / no-risk messages. Latency: all 2,044 shared messages. Labels are model-generated; this is not clinical validation. Cost is a recorded estimate for Jev user checks, excluding companion generation and reply checks.">
      <div className="grid gap-7 sm:grid-cols-3">
        {[
          ["0.992", "AUC", "Self-harm vs. no risk"],
          ["0.50s", "Median user check", "0.67s at the 90th percentile"],
          ["$0.04", "Per 1,000 user checks", "Recorded benchmark estimate"],
        ].map(([value, title, detail]) => <section key={title} className="border-t-2 border-accent pt-6"><p className="text-5xl font-semibold tracking-tight text-accent sm:text-6xl">{value}</p><h2 className="mt-4 text-2xl font-medium">{title}</h2><p className="mt-2 text-lg text-muted">{detail}</p></section>)}
      </div>
      <div className="border-t border-ink/15 pt-6"><p className={body}>The remaining challenge: <strong>conversation-level over-escalation.</strong></p><p className="mt-3 text-xl text-muted">Reply checking still needs an independent labelled evaluation.</p></div>
    </Frame>
  );
}

export function PitchNext() {
  return (
    <Frame chapter="The working POC" title="A safety decision you can inspect and test." note="A developer prototype for AI companions. Human response operations and clinical validation are not part of this POC.">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <section className="border-t-2 border-accent pt-6"><h2 className={label}>Working today</h2><p className="mt-5 text-3xl leading-snug font-medium">A runnable harness.<br />An inspectable decision.<br />A replayable intervention.</p><p className="mt-5 text-xl leading-relaxed text-muted">User and reply checks, remembered risk, crisis short-circuiting, and fallbacks.</p></section>
        <section className="border-t border-ink/20 pt-6"><h2 className={label}>Next milestones</h2><ol className="mt-5 space-y-4 text-xl leading-relaxed"><li><span className="mr-4 font-mono text-accent">01</span>Evaluate replies and reduce over-escalation.</li><li><span className="mr-4 font-mono text-accent">02</span>Connect escalation to a human response workflow.</li><li><span className="mr-4 font-mono text-accent">03</span>Package a companion integration example.</li></ol></section>
      </div>
      <div className="flex flex-wrap items-center gap-6"><Link href="/demo" className="rounded-full bg-ink px-6 py-3 text-lg font-medium text-white hover:bg-ink/80">Try FirstRead →</Link><Link href="/deck/7" className="text-lg font-medium text-accent hover:underline">Explore the evidence appendix →</Link></div>
    </Frame>
  );
}
