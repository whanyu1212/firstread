import type { ComponentType } from "react";
import Problem from "./pitch-01-problem.mdx";
import Intervention from "./pitch-02-intervention.mdx";
import Architecture from "./pitch-03-architecture.mdx";
import Continuity from "./pitch-04-continuity.mdx";
import Evidence from "./pitch-05-evidence.mdx";
import Next from "./pitch-06-next.mdx";
import WhyJev from "./03-why-jev.mdx";
import AnswersToLevel from "./04-answers-to-level.mdx";
import Harness from "./05-harness.mdx";
import Iterations from "./06-iterations.mdx";
import Honest from "./07-honest.mdx";

export interface SlideMeta {
  title: string;
  act: string | null;
  appendix?: boolean;
  /** Highest build step on the slide; the main pitch has no hidden builds. */
  steps: number;
}

/** Six pitch slides, then optional evidence for Q&A. */
export const SLIDES: (SlideMeta & { Content: ComponentType })[] = [
  { title: "The problem", act: "Pitch", steps: 0, Content: Problem },
  { title: "The intervention", act: "Pitch", steps: 0, Content: Intervention },
  { title: "Why Jev", act: "Pitch", steps: 0, Content: Architecture },
  { title: "Beyond one message", act: "Pitch", steps: 0, Content: Continuity },
  { title: "The evidence", act: "Pitch", steps: 0, Content: Evidence },
  { title: "The working POC", act: "Pitch", steps: 0, Content: Next },
  { title: "Model comparison", act: "Appendix", appendix: true, steps: 2, Content: WhyJev },
  { title: "Signals and policy", act: "Appendix", appendix: true, steps: 3, Content: AnswersToLevel },
  { title: "Inside the harness", act: "Appendix", appendix: true, steps: 4, Content: Harness },
  { title: "Iteration history", act: "Appendix", appendix: true, steps: 3, Content: Iterations },
  { title: "Evaluation limits", act: "Appendix", appendix: true, steps: 4, Content: Honest },
];
