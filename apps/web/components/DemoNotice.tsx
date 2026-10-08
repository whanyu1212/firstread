import { SINGAPORE } from "firstread/resources";

/**
 * Always visible on /demo (HY-153): a public mental health demo with no human behind it must say
 * so, and must show where real help is. The numbers stay on screen, as the sources give them; only
 * the privacy detail folds. Kept to a strip so the conversation keeps the screen: on a phone each
 * line shows its first way to reach it (the start of the source's text), and the rest folds.
 */
export function DemoNotice() {
  const lines = SINGAPORE.lines;
  return (
    <section aria-label="About this demo" className="glass rounded-xl px-4 py-2 text-sm">
      <div className="flex gap-2.5">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-level-watch" aria-hidden="true" />
        <div>
          <span className="font-semibold">This is a demonstration, not a support service. No one reads these chats,</span>{" "}
          so please don't share personal details. If you need to talk to someone now:{" "}
          {lines.map((l) => (
            <span key={l.name}>
              <span className="font-medium">{l.name}</span>, <span className="sm:hidden">{l.contact.split(",")[0]}</span>
              <span className="hidden sm:inline">{l.contact}</span> ({l.hours}).{" "}
            </span>
          ))}
          In immediate danger, call <span className="font-medium">{SINGAPORE.emergency}</span>.{" "}
          <details className="inline [&[open]]:block">
            <summary className="inline cursor-pointer text-accent">
              <span className="sm:hidden">More ways to reach them, and where your messages go</span>
              <span className="hidden sm:inline">Where your messages go</span>
            </summary>
            <ul className="mt-1 space-y-0.5 text-ink/75 sm:hidden">
              {lines.map((l) => (
                <li key={l.name}>
                  {l.name}: {l.contact} ({l.hours})
                </li>
              ))}
            </ul>
            <span className="mt-1 block max-w-[70ch] text-ink/75">
              Messages go to OpenAI (with your key) for the companion, and to Jev through Vercel AI Gateway for FirstRead's checks.
              Conversations are kept for a short time, then deleted.
            </span>
          </details>
        </div>
      </div>
    </section>
  );
}
