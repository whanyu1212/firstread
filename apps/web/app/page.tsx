import { REPLY_QUESTIONS, USER_TURN_QUESTIONS } from "firstread";
import Link from "next/link";
import { Glow } from "@/components/Glow";
import { Logo } from "@/components/Logo";
import { TurnPreview } from "@/components/TurnPreview";
import bhh from "@/slides/data/bhh.json";

const EVENT_URL = "https://luma.com/ltjmoydo";
// Grey text outside the glass sits on the glow, so it is darker than text-muted to stay above 4.5:1.
const ON_GLOW = "text-ink/75";

// Every number on the page is read from the deck's chart data or the question set, not typed in.
const jev = bhh.runs.find((r) => r.id === "jev")!;
const others = bhh.runs.filter((r) => r.id !== "jev");
const bestAuc = [...others].sort((a, b) => b.auc - a.auc)[0]!;
const fastest = [...others].sort((a, b) => a.latency.p50 - b.latency.p50)[0]!;
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const count = (n: number) => n.toLocaleString("en-US");
const userQuestions = Object.keys(USER_TURN_QUESTIONS).length;
const replyQuestions = Object.keys(REPLY_QUESTIONS).length;

const STATS = [
  {
    value: jev.auc.toFixed(3),
    versus: `Next best: ${bestAuc.name}, ${bestAuc.auc.toFixed(3)}`,
    body: `How well each one separates risk from no risk (AUC), on ${count(bhh.cases.positive)} messages with self-harm risk and ${count(bhh.cases.negative)} without.`,
  },
  {
    value: seconds(jev.latency.p50),
    versus: `Next fastest: ${fastest.name}, ${seconds(fastest.latency.p50)}`,
    body: "Median time per check, on the same messages.",
  },
  {
    value: String(userQuestions),
    body: `Questions Jev answers about each message, in one call. Another ${replyQuestions} check the companion's draft.`,
  },
];

/** The kickoff's three questions about Jev, and what FirstRead shows for each. */
const SHOWING = [
  {
    question: "How is Jev different from an LLM?",
    title: "It gives a judgement, not a generation.",
    body: "Jev returns a probability for each yes/no question instead of writing text, so FirstRead sets its thresholds on numbers it can test.",
  },
  {
    question: "Why does Jev lower the cost of judgement?",
    title: "Every turn gets checked, not a sample.",
    body: `One call answers all ${userQuestions} questions about a message in about half a second, so checking every turn is practical.`,
  },
  {
    question: "How does Jev fit into an agent harness?",
    title: "It sits in front of every reply.",
    body: "The user check runs while the companion writes its draft. The policy sends the draft, replaces it with a reply that points to support, or emits an escalation event for the host app. If Jev doesn't answer in time, the draft isn't sent.",
  },
];

const LINKS = [
  { href: "/deck/1", title: "Open the deck", body: "Why Jev fits the problem, and how we got here." },
  {
    href: "/demo",
    title: "Try the demo",
    body: "Watch recorded scenarios without an API key, or bring an OpenAI API key to try a live conversation.",
  },
];

export default function Home() {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <Glow />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 lg:pt-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <a
            href={EVENT_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-ink/10 bg-white/60 px-3 py-1.5 text-xs text-ink/75 transition-colors hover:bg-white sm:text-sm"
          >
            Built for <span className="font-semibold">What Would Jev Do?</span>
          </a>
        </header>

        <section className="mt-12 grid items-center gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12" aria-labelledby="hero-title">
          <div className="lg:pb-6">
            <p className="mb-5 text-sm font-medium text-ink/75">A safety layer for AI companions</p>
            <h1 id="hero-title" className="text-[2.75rem] leading-[1.06] font-semibold tracking-[-0.045em] sm:text-6xl lg:text-[3.5rem] xl:text-[3.75rem]">
              <span className="block">Read the risk.</span>
              <span className="block">Check the reply.</span>
              <span className="mt-2 block text-balance text-accent">Before it reaches the user.</span>
            </h1>
            <p className={`mt-6 max-w-[29em] text-lg leading-relaxed ${ON_GLOW}`}>
              FirstRead adds two Jev checks to your mental health companion: one reads the user’s message, the other checks the draft.
              A policy that remembers risk across turns decides what gets sent.
            </p>
            <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
              <Link href="/demo" className="inline-flex min-h-12 items-center justify-center gap-6 rounded-xl bg-ink px-5 py-3 font-medium text-white transition-colors hover:bg-ink/85">
                Watch the demo <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/deck/1" className="inline-flex min-h-12 items-center justify-center gap-6 rounded-xl border border-ink/15 bg-white/70 px-5 py-3 font-medium transition-colors hover:bg-white">
                Explore the evidence <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="mt-3 text-sm text-ink/75">No API key needed for recorded scenarios.</p>
            <p className="mt-8 max-w-[30em] border-l-2 border-accent/30 pl-4 text-sm leading-relaxed text-ink/75">
              Send a checked reply. Replace an unsafe draft. Emit an escalation event when human support is needed.
            </p>
          </div>
          <TurnPreview />
        </section>

        <section className="mt-20 lg:mt-28" aria-labelledby="numbers">
          <h2 id="numbers" className="text-2xl font-semibold tracking-tight">
            Jev, measured
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.value} className="glass rounded-2xl p-6">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-4xl font-medium tracking-tight">{s.value}</span>
                  {s.versus && <span className="font-mono text-sm text-muted">{s.versus}</span>}
                </p>
                <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
          <p className={`mt-4 text-sm ${ON_GLOW}`}>
            Benchmark: the Between Help and Harm test split. Jev and {others.length} general models (
            {others.slice(0, -1).map((r) => r.name).join(", ")} and {others.at(-1)!.name}) answered the same questions
            about the same messages.
          </p>
        </section>

        <section className="mt-20 lg:mt-28" aria-labelledby="showing">
          <h2 id="showing" className="text-2xl font-semibold tracking-tight">
            What we're showing with Jev
          </h2>
          <ul className="glass mt-6 divide-y divide-ink/8 rounded-3xl">
            {SHOWING.map((s) => (
              <li key={s.question} className="grid gap-2 p-6 sm:p-8 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-10">
                <p className="text-muted">{s.question}</p>
                <div>
                  <p className="text-lg font-semibold">{s.title}</p>
                  <p className="mt-1.5 max-w-[40em] leading-relaxed text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:mt-28" aria-label="See it">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="glass rounded-2xl p-6 transition-colors hover:bg-white/80 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight">{l.title}</h2>
              <p className="mt-2 leading-relaxed text-muted">{l.body}</p>
            </Link>
          ))}
        </section>

        <footer className={`mt-16 border-t border-ink/10 pt-6 text-sm ${ON_GLOW}`}>
          FirstRead flags risk and emits escalation events for the host app to handle. It doesn't diagnose, and it isn't a replacement for
          human crisis support.
        </footer>
      </main>
    </div>
  );
}
