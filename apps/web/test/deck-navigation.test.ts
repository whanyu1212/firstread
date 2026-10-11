import { describe, expect, it } from "vitest";
import { deckSection } from "@/lib/deck-navigation";

describe("pitch and appendix navigation", () => {
  const slides = [...Array.from({ length: 6 }, () => ({})), ...Array.from({ length: 5 }, () => ({ appendix: true }))];

  it("stops the main presentation before the appendix", () => {
    for (let index = 1; index <= 6; index++) {
      expect(deckSection(slides, index)).toEqual({ first: 1, last: 6, appendixStart: 7 });
    }
  });

  it("keeps appendix back, forward, Home and End within its own section", () => {
    for (let index = 7; index <= 11; index++) {
      expect(deckSection(slides, index)).toEqual({ first: 7, last: 11, appendixStart: 7 });
    }
  });

  it("supports decks with no appendix", () => {
    expect(deckSection([{}, {}], 2)).toEqual({ first: 1, last: 2, appendixStart: 3 });
  });
});
