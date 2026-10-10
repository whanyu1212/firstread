import type { ReactNode } from "react";
import { DeckGlow } from "@/components/deck/DeckGlow";

/** The glow sits here rather than in each slide, so it can drift from one slide's place to the next. */
export default function DeckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate overflow-x-clip">
      <DeckGlow />
      {children}
    </div>
  );
}
