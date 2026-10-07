import { SINGAPORE, type SupportResources } from "firstread/resources";

/**
 * The part of the prompt with the verified support lines (firstread/resources). Always included:
 * it's short, it must be exact, and at ELEVATED FirstRead replaces any reply without them.
 */
export function supportLinesSkill(resources: SupportResources = SINGAPORE): string {
  const lines = resources.lines.map((l) => `- ${l.name}: ${l.contact} (${l.hours}), for ${l.for}`).join("\n");
  return `${lines}\n- In immediate danger: call ${resources.emergency}`;
}
