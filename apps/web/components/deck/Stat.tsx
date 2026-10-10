/**
 * A chart's headline number, read from the same data as the chart. The swatch ties it to its
 * series; the number itself stays in ink, as the dataviz rules ask.
 */
export function Stat({ value, label, color, versus }: { value: string; label: string; color?: string; versus?: string }) {
  return (
    <div className="mb-6">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">{value}</span>
        <span className="flex items-center gap-2 text-lg">
          {color && <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />}
          {label}
        </span>
      </p>
      {versus && <p className="mt-1 text-base text-muted">{versus}</p>}
    </div>
  );
}
