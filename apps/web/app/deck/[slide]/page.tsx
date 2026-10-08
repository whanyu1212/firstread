import { notFound } from "next/navigation";
import { DeckShell } from "@/components/DeckShell";
import { SLIDES } from "@/slides";

export function generateStaticParams() {
  return SLIDES.map((_, i) => ({ slide: String(i + 1) }));
}

export default async function SlidePage({ params }: { params: Promise<{ slide: string }> }) {
  const n = Number((await params).slide);
  const slide = Number.isInteger(n) ? SLIDES[n - 1] : undefined;
  if (!slide) notFound();
  return (
    <DeckShell index={n} total={SLIDES.length} steps={slide.steps} title={slide.title}>
      <slide.Content />
    </DeckShell>
  );
}
