/** One-based bounds keep keyboard navigation within the pitch or its optional appendix. */
export function deckSection(slides: readonly { appendix?: boolean }[], index: number) {
  const start = slides.findIndex((slide) => slide.appendix);
  const appendixStart = start < 0 ? slides.length + 1 : start + 1;
  return {
    first: index >= appendixStart ? appendixStart : 1,
    last: index >= appendixStart ? slides.length : appendixStart - 1,
    appendixStart,
  };
}
