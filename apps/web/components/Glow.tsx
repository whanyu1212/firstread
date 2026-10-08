/**
 * Soft colour behind the glass, so it has something to frost: the landing page and the demo's frame.
 * Still, and fixed to the viewport. Sized to the viewport's width, and fainter below lg, where
 * single-column layouts put text over it.
 */
export function Glow() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[12vw] -left-[10vw] size-[40vw] rounded-full bg-glow-blue opacity-60 blur-[max(7vw,48px)] lg:opacity-90" />
      <div className="absolute top-1/4 -right-[12vw] size-[44vw] rounded-full bg-glow-sage opacity-60 blur-[max(7vw,48px)] lg:opacity-90" />
      <div className="absolute -bottom-[14vw] left-1/3 size-[35vw] rounded-full bg-glow-blue opacity-50 blur-[max(7vw,48px)] lg:opacity-70" />
    </div>
  );
}
