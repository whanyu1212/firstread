/**
 * Check conversations.jsonl after editing it: label consistency (the same checks the runner does
 * on load), the split and category balance, and overlap with BHH and cases.jsonl.
 *
 *     pnpm check:conversations
 *
 * Overlap is word-trigram Jaccard, plus containment (the share of the turn's trigrams found in one
 * reference) so a short line lifted from a long post still shows up. Common phrases ("i'm being
 * dramatic") score high on containment too, so anything flagged is for a person to read, not an
 * automatic failure. BHH is only checked if `pnpm fetch:bhh` has been run.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConversations } from "./conversations";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const FLAG_AT = 0.4;

const convs = loadConversations(here("./conversations.jsonl")); // throws on label errors
const count = (key: (c: (typeof convs)[number]) => string) =>
  Object.fromEntries(
    [...new Set(convs.map(key))].map((k) => [k, convs.filter((c) => key(c) === k).length]),
  );
console.log(
  `${convs.length} conversations, ${convs.reduce((n, c) => n + c.exchanges.length, 0)} exchanges; labels consistent`,
);
console.log("split:   ", count((c) => c.split));
console.log("category:", count((c) => c.category));
console.log("target:  ", count((c) => String(c.target)));
console.log("policy questions:", convs.filter((c) => c.policy_question).map((c) => c.id).join(", ") || "none");

const trigrams = (text: string) => {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  return new Set(words.slice(2).map((_, i) => words.slice(i, i + 3).join(" ")));
};
const readJsonl = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const refs: { id: string; grams: Set<string> }[] = [];
for (const split of ["validation", "test"]) {
  const path = here(`./data/bhh-${split}.jsonl`);
  if (existsSync(path)) for (const r of readJsonl(path)) refs.push({ id: `bhh:${r.id}`, grams: trigrams(r.text) });
}
const bhhChecked = refs.length > 0;
for (const r of readJsonl(here("./cases.jsonl"))) {
  for (const t of r.user_turns) refs.push({ id: `cases:${r.id}`, grams: trigrams(t) });
}

const scores: { score: number; ref: string; where: string; text: string }[] = [];
for (const c of convs) {
  c.exchanges.forEach((x, i) => {
    const g = trigrams(x.user);
    if (g.size < 3) return;
    let best = { score: 0, ref: "" };
    for (const r of refs) {
      const shared = [...g].filter((t) => r.grams.has(t)).length;
      if (!shared) continue;
      const jaccard = shared / (g.size + r.grams.size - shared);
      const score = Math.max(jaccard, shared / g.size);
      if (score > best.score) best = { score, ref: r.id };
    }
    scores.push({ ...best, where: `${c.id}#${i + 1}`, text: x.user });
  });
}
scores.sort((a, b) => b.score - a.score);

console.log(`\noverlap with ${bhhChecked ? "BHH and " : ""}cases.jsonl${bhhChecked ? "" : " (BHH not downloaded)"}:`);
for (const s of scores.slice(0, 5)) {
  console.log(`  ${s.score.toFixed(2)}  ${s.ref.padEnd(26)} ${s.where}: ${JSON.stringify(s.text.slice(0, 70))}`);
}
const flagged = scores.filter((s) => s.score > FLAG_AT);
console.log(`${flagged.length} turns over ${FLAG_AT}: read them against the reference before committing`);
