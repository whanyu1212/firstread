"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { FirstReadTurn } from "./deck/FirstReadTurn";
import { StepContext } from "./deck/steps";

/**
 * The landing page's one moment of motion: slide 1's recorded turn plays through once on load,
 * the message read first, then the draft held and replaced. With reduced motion on, it starts at
 * its final state.
 */
export function TurnPreview() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) {
      setStep(2);
      return;
    }
    // Step 2 waits for step 1's note, which lands about a second after the message.
    const timers = [setTimeout(() => setStep(1), 300), setTimeout(() => setStep(2), 2300)];
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  return (
    <MotionConfig reducedMotion="user">
      <StepContext.Provider value={step}>
        <FirstReadTurn />
      </StepContext.Provider>
    </MotionConfig>
  );
}
