/** A labelled illustration, not a transcript: recorded runs do not retain the original draft. */
export function TurnPreview() {
  return (
    <figure className="overflow-hidden rounded-[24px] border border-ink/10 bg-canvas shadow-[0_24px_70px_-28px_rgb(23_23_23/25%)]">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
        <span className="text-sm font-semibold">One reply. One intervention.</span>
        <span className="rounded-full bg-raised px-2.5 py-1 text-xs text-muted">Illustrative example</span>
      </figcaption>
      <div className="p-5 sm:p-6">
        <div className="mb-6 border-l-2 border-ink/20 pl-4">
          <p className="text-xs font-medium text-muted">User message</p>
          <p className="mt-1 text-lg leading-snug">“Everything feels pointless lately.”</p>
        </div>
        <ol className="relative space-y-5 before:absolute before:top-4 before:bottom-4 before:left-3.5 before:w-px before:bg-line">
          <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
            <span className="flex size-7 items-center justify-center rounded-full border border-line bg-canvas font-mono text-xs text-muted" aria-hidden="true">1</span>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <h2 className="text-sm font-semibold">Companion draft</h2>
                <span className="text-xs font-medium text-muted">Held before delivery</span>
              </div>
              <blockquote className="mt-2 rounded-xl bg-raised px-4 py-3 text-sm leading-relaxed text-ink/75">
                “That sounds really hard. Do you want to tell me more about your day?”
              </blockquote>
            </div>
          </li>
          <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent font-mono text-xs text-white" aria-hidden="true">2</span>
            <div className="rounded-xl border border-accent/20 bg-accent/[0.04] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">FirstRead decision</h2>
                <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white">Replace</span>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                  <dt className="text-muted">User check</dt>
                  <dd className="font-medium text-[#98421f]">Elevated risk</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                  <dt className="text-muted">Reply check</dt>
                  <dd className="font-medium">Support resources missing</dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-accent/15 pt-3 text-sm leading-relaxed text-ink/75">
                Support is due on this turn. The policy replaces the draft with a reply that points to help.
              </p>
            </div>
          </li>
          <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
            <span className="flex size-7 items-center justify-center rounded-full border border-line bg-canvas font-mono text-xs text-muted" aria-hidden="true">3</span>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <h2 className="text-sm font-semibold">Delivered reply</h2>
                <span className="text-xs font-medium text-muted">Replacement excerpt</span>
              </div>
              <blockquote className="mt-2 rounded-xl border border-[#cbded1] bg-[#f2f8f4] px-4 py-3 text-sm leading-relaxed">
                “I’m really glad you told me this, and I want to make sure you get the right support. It sounds like you’re carrying a lot right now.”
                <span className="mt-2 block border-t border-[#cbded1] pt-2 font-medium text-[#375a44]">
                  + Local crisis support contacts
                </span>
              </blockquote>
            </div>
          </li>
        </ol>
      </div>
    </figure>
  );
}
