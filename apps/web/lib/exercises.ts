/**
 * Short, widely used self-soothing exercises the companion can offer. General wellbeing
 * techniques, not treatment; the companion offers them, it doesn't prescribe them.
 */

export const EXERCISES = {
  box_breathing: {
    name: "Box breathing",
    when: "feeling tense or panicky",
    steps: [
      "Breathe in slowly through your nose for a count of four.",
      "Hold your breath for a count of four.",
      "Breathe out slowly through your mouth for a count of four.",
      "Hold for a count of four, then repeat for a few rounds.",
    ],
  },
  grounding_54321: {
    name: "5-4-3-2-1 grounding",
    when: "feeling overwhelmed or caught up in your thoughts",
    steps: [
      "Name five things you can see around you.",
      "Name four things you can feel, like your feet on the floor.",
      "Name three things you can hear.",
      "Name two things you can smell.",
      "Name one thing you can taste.",
    ],
  },
  slow_exhale: {
    name: "Slow exhale",
    when: "you want to calm down quickly",
    steps: [
      "Breathe in gently for a count of four.",
      "Breathe out more slowly, for a count of six.",
      "Keep going for about a minute, letting your shoulders drop as you breathe out.",
    ],
  },
} as const;

export type ExerciseKind = keyof typeof EXERCISES;
export const EXERCISE_KINDS = Object.keys(EXERCISES) as [ExerciseKind, ...ExerciseKind[]];
