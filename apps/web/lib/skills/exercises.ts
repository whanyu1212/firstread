/**
 * Guided exercises the companion can offer. General wellbeing techniques, not treatment.
 *
 * The prompt only gets the index (id and when to use it, about 15 tokens each). The model names an
 * id with its reply and the page shows the steps from here, so the library can grow without growing
 * the prompt, and the steps are always exactly as written. If it grows into the hundreds, narrow
 * the index by tags before the call rather than listing everything.
 */

export interface Exercise {
  id: string;
  name: string;
  /** One line for the model: when this fits. */
  when: string;
  tags: string[];
  steps: string[];
}

export const EXERCISES = {
  box_breathing: {
    id: "box_breathing",
    name: "Box breathing",
    when: "tense or panicky, and wants something to do with their breath",
    tags: ["panic", "anxiety", "breathing"],
    steps: [
      "Breathe in slowly through your nose for a count of four.",
      "Hold your breath for a count of four.",
      "Breathe out slowly through your mouth for a count of four.",
      "Hold for a count of four, then repeat for a few rounds.",
    ],
  },
  slow_exhale: {
    id: "slow_exhale",
    name: "Slow exhale",
    when: "needs to calm down quickly, e.g. right before something stressful",
    tags: ["panic", "anxiety", "breathing", "quick"],
    steps: [
      "Breathe in gently for a count of four.",
      "Breathe out more slowly, for a count of six.",
      "Keep going for about a minute, letting your shoulders drop as you breathe out.",
    ],
  },
  grounding_54321: {
    id: "grounding_54321",
    name: "5-4-3-2-1 grounding",
    when: "overwhelmed or caught up in racing thoughts",
    tags: ["overwhelm", "anxiety", "grounding"],
    steps: [
      "Name five things you can see around you.",
      "Name four things you can feel, like your feet on the floor.",
      "Name three things you can hear.",
      "Name two things you can smell.",
      "Name one thing you can taste.",
    ],
  },
  muscle_release: {
    id: "muscle_release",
    name: "Quick muscle release",
    when: "holding tension in their body, or can't settle to sleep",
    tags: ["tension", "sleep", "relaxation"],
    steps: [
      "Squeeze your hands into fists for five seconds, then let go and notice the difference.",
      "Lift your shoulders up to your ears for five seconds, then let them drop.",
      "Scrunch your face for five seconds, then relax it.",
      "Take one slow breath and notice where you feel looser.",
    ],
  },
} as const satisfies Record<string, Exercise>;

export type ExerciseId = keyof typeof EXERCISES;
export const EXERCISE_IDS = Object.keys(EXERCISES) as [ExerciseId, ...ExerciseId[]];

/** The part of the prompt that lists exercises: ids and when to use them, never the steps. */
export function exerciseIndex(): string {
  return Object.values(EXERCISES)
    .map((e) => `- ${e.id}: ${e.when}`)
    .join("\n");
}
