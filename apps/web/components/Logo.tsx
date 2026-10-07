/**
 * The FirstRead mark: a message, with an F cut out of it. The F's stem is the margin rule and its
 * middle arm is the rule's dot, as in the demo. One colour (currentColor); the cut-out shows
 * whatever is behind it, so it works on any background. app/icon.svg is the same drawing.
 */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true" focusable="false">
      <mask id="firstread-mark-cutout">
        <rect width="72" height="72" fill="white" />
        <rect x="20" y="12" width="9" height="34" rx="4.5" fill="black" />
        <rect x="20" y="12" width="34" height="9" rx="4.5" fill="black" />
        <circle cx="45" cy="36" r="6.5" fill="black" />
      </mask>
      <path
        d="M18 0H54A16 16 0 0 1 70 16V42A16 16 0 0 1 54 58H18L2 72V16A16 16 0 0 1 18 0Z"
        fill="currentColor"
        mask="url(#firstread-mark-cutout)"
      />
    </svg>
  );
}

/** The mark with the name beside it. */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = {
    sm: { mark: "size-4", text: "text-sm", gap: "gap-1.5" },
    md: { mark: "size-6", text: "text-xl", gap: "gap-2" },
    lg: { mark: "size-9", text: "text-4xl", gap: "gap-3" },
  }[size];
  return (
    <span className={`inline-flex items-center ${s.gap} font-semibold tracking-[-0.03em] text-ink`}>
      <LogoMark className={`${s.mark} shrink-0`} />
      <span className={s.text}>FirstRead</span>
    </span>
  );
}
