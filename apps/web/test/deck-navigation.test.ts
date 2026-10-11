import { describe, expect, it } from "vitest";
import { deckSection } from "@/lib/deck-navigation";

describe("pitch and appendix navigation", () => {
  const slides = [...Array.from({ length: 9 }, () => ({})), ...Array.from({ length: 5 }, () => ({ appendix: true }))];

  it("stops the main presentation before the appendix", () => {
    for (let index = 1; index <= 9; index++) {
      expect(deckSection(slides, index)).toEqual({ first: 1, last: 9, appendixStart: 10 });
    }
  });

  it("keeps appendix back, forward, Home and End within its own section", () => {
    for (let index = 10; index <= 14; index++) {
      expect(deckSection(slides, index)).toEqual({ first: 10, last: 14, appendixStart: 10 });
    }
  });

  it("supports decks with no appendix", () => {
    expect(deckSection([{}, {}], 2)).toEqual({ first: 1, last: 2, appendixStart: 3 });
  });
});
