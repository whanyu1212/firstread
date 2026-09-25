/**
 * Download the "Between Help and Harm" crisis benchmark into evals/data/.
 *
 *     pnpm fetch:bhh
 *
 * Source: https://huggingface.co/datasets/arnaiztech/llms-mental-health-crisis-benchmark
 * Paper:  Arnaiz-Rodriguez et al., JMIR Mental Health (2026), https://doi.org/10.2196/88435
 * License: CC-BY-NC-4.0 (non-commercial). The data is not committed; evals/data/ is gitignored.
 *
 * Splits:
 *   - validation: 206 examples, labelled by humans (majority of 4-5 annotators). Ties are dropped.
 *   - test: 2,046 examples, labelled by gpt-4o-mini (majority of 3 runs). Weaker ground truth.
 *
 * The source stores each example as a list of sentences, not a real back-and-forth,
 * so we join them into a single user message.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BHH_LABELS = [
  "no_crisis",
  "suicidal_ideation",
  "self_harm",
  "violent_thoughts",
  "anxiety_crisis",
  "substance_abuse_or_withdrawal",
  "risk_taking_behaviors",
] as const;
export type BhhLabel = (typeof BHH_LABELS)[number];

export type BhhCase = {
  id: string;
  label: BhhLabel;
  label_source: "human" | "gpt-4o-mini";
  source: string;
  text: string;
};

const DATASET = "arnaiztech/llms-mental-health-crisis-benchmark";
const ROWS_URL = "https://datasets-server.huggingface.co/rows";
const PAGE = 100; // datasets-server maximum

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

type Example = { example_id: string; inputs: string[]; source_dataset_id: string };
type Label = { example_id: string; final_label: string | null; label_resolved: boolean };

async function fetchRows<T>(config: string, split: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${ROWS_URL}?dataset=${DATASET}&config=${config}&split=${split}&offset=${offset}&length=${PAGE}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${config}/${split} @ ${offset}`);
    const body = (await res.json()) as { rows: { row: T }[]; num_rows_total: number };
    rows.push(...body.rows.map((r) => r.row));
    if (rows.length >= body.num_rows_total || body.rows.length === 0) return rows;
  }
}

async function fetchSplit(split: "validation" | "test"): Promise<BhhCase[]> {
  const labelConfig = split === "validation" ? "human_merged_labels" : "llm_merged_labels";
  const [examples, labels] = await Promise.all([
    fetchRows<Example>("examples", split),
    fetchRows<Label>(labelConfig, split),
  ]);
  const labelById = new Map(labels.map((l) => [l.example_id, l]));

  const cases: BhhCase[] = [];
  let dropped = 0;
  for (const ex of examples) {
    const l = labelById.get(ex.example_id);
    if (!l?.label_resolved || !BHH_LABELS.includes(l.final_label as BhhLabel)) {
      dropped++;
      continue;
    }
    cases.push({
      id: ex.example_id,
      label: l.final_label as BhhLabel,
      label_source: split === "validation" ? "human" : "gpt-4o-mini",
      source: ex.source_dataset_id,
      text: ex.inputs.join(" "),
    });
  }
  console.log(`${split}: ${cases.length} cases (${dropped} dropped: no resolved label)`);
  return cases;
}

const revision = await fetch(`https://huggingface.co/api/datasets/${DATASET}`)
  .then((r) => r.json() as Promise<{ sha: string }>)
  .then((d) => d.sha);

mkdirSync(here("./data"), { recursive: true });
for (const split of ["validation", "test"] as const) {
  const cases = await fetchSplit(split);
  writeFileSync(here(`./data/bhh-${split}.jsonl`), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
}
writeFileSync(
  here("./data/bhh.meta.json"),
  JSON.stringify({ dataset: DATASET, revision, license: "cc-by-nc-4.0", fetched_at: new Date().toISOString() }, null, 2) + "\n",
);
console.log(`wrote evals/data/bhh-{validation,test}.jsonl (revision ${revision.slice(0, 7)})`);
