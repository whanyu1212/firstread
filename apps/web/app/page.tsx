import Link from "next/link";
import { Glow } from "@/components/Glow";
import { Logo } from "@/components/Logo";
import { TurnPreview } from "@/components/TurnPreview";
import bhh from "@/slides/data/bhh.json";

const EVENT_URL = "https://luma.com/ltjmoydo";
// Grey text outside the glass sits on the glow, so it is darker than text-muted to stay above 4.5:1.
const ON_GLOW = "text-ink/75";

// Every benchmark number is read from the deck's chart data.
const jev = bhh.runs.find((r) => r.id === "jev")!;
const others = bhh.runs.filter((r) => r.id !== "jev");
const bestAuc = [...others].sort((a, b) => b.auc - a.auc)[0]!;
const fastest = [...others].sort((a, b) => a.latency.p50 - b.latency.p50)[0]!;
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const count = (n: number) => n.toLocaleString("en-US");

const STATS = [
  {
    value: jev.auc.toFixed(3),
    label: "Risk discrimination (AUC)",
    versus: `Next best: ${bestAuc.name}, ${bestAuc.auc.toFixed(3)}`,
  },
  {
    value: seconds(jev.latency.p50),
    label: "Median time per check",
    versus: `Next fastest: ${fastest.name}, ${seconds(fastest.latency.p50)}`,
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
          </div>
          <TurnPreview />
        </section>

        <section className="glass mt-12 rounded-2xl p-5 sm:p-6 lg:mt-16" aria-labelledby="numbers">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="numbers" className="text-lg font-semibold tracking-tight">Jev, measured</h2>
            <a href="https://github.com/whanyu1212/firstread#single-messages-jev-against-four-general-models" className="text-sm text-accent underline underline-offset-4 hover:text-ink">
              Benchmark & methodology <span aria-hidden="true">↗</span>
            </a>
          </div>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-3xl font-medium tracking-tight">{s.value}</span>
                  <span className="text-sm text-muted">{s.versus}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-ink/10 pt-4 text-sm leading-relaxed text-muted">
            Between Help and Harm test split: AUC on {count(bhh.cases.positive)} self-harm messages and {count(bhh.cases.negative)} without risk;
            latency across all {count(bhh.shared)} messages. These are benchmark results, not clinical validation.
          </p>
        </section>

        <footer className={`mt-8 text-sm leading-relaxed ${ON_GLOW}`}>
          FirstRead flags risk and emits escalation events for the host app to handle. It doesn't diagnose, and it isn't a replacement for
          human crisis support.
        </footer>
      </main>
    </div>
  );
}
