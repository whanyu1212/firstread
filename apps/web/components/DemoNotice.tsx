import { SINGAPORE } from "firstread/resources";

/**
 * The demo boundary and every support contact stay visible; only data handling folds.
 */
export function DemoNotice() {
  return (
    <section aria-label="About this demo" className="shrink-0 rounded-xl border border-ink/10 bg-white/65 px-4 py-2.5 text-xs leading-relaxed">
      <p><span className="font-semibold">Demo only. No one monitors these chats.</span> Please use synthetic messages, not personal details.</p>
      <p className="mt-1 text-ink/75">
        Real support:{" "}
        {SINGAPORE.lines.map((l) => (
          <span key={l.name}>
            <span className="font-medium">{l.name}</span>, {l.contact} ({l.hours}).{" "}
          </span>
        ))}
        In immediate danger, call <span className="font-medium">{SINGAPORE.emergency}</span>.
      </p>
      <details className="mt-1">
        <summary className="w-fit cursor-pointer text-accent">Where your messages go</summary>
        <p className="mt-2 max-w-3xl text-ink/75">
          Live messages go to OpenAI (on the demo's key, or yours if you add one) for the companion, and to Jev through Vercel AI Gateway for FirstRead's checks.
          Live conversations are kept for a short time, then deleted. Recorded scenarios play locally in your browser.
        </p>
      </details>
    </section>
  );
}
