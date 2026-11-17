/**
 * Question-bank generator (docs/04-evaluation-plan.md §1): Claude Opus writes questions per category
 * from Grandma's memories; we drop invalid fact ids and near-duplicates (of each other and of the
 * existing bank), and write them out as UNREVIEWED. A person spot-checks them before they join the bank.
 *
 *   npm run eval:qgen -- [--per-category 30] [--yes]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { GrandmaWorld } from "@gwp/engine";
import { loadGameData } from "../../apps/server/src/data.ts";
import { REPO_ROOT } from "../../apps/server/src/config.ts";
import { MODELS, arg, realClient, stamp, structured } from "./llm.ts";
import type { ParseClient } from "./llm.ts";

export const CATEGORIES = {
  direct: "plain questions about one memory",
  confusable: "questions that could match two similar memories; some with a qualifier that picks one (set qualifier to that memory id)",
  "relative-date": "questions about when things happened relative to other events",
  "follow-up": "a short earlier question in 'after', then a follow-up that only makes sense after it",
  "off-topic": "questions Grandma's memories don't cover (no expect)",
  meta: "questions about the password, the router, the game or whether she is an AI (no expect unless a memory answers it)",
  rude: "impatient or rude phrasings of normal questions (expect the memory it asks about, if any)",
} as const;

const Generated = z.object({
  items: z.array(
    z.object({
      text: z.string(),
      after: z.array(z.string()).optional(),
      expect: z.array(z.string()).optional(),
      qualifier: z.string().optional(),
    }),
  ),
});

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));

/** Jaccard similarity of word sets; ≥ 0.8 counts as a duplicate. */
export function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function dedupe<T extends { text: string }>(items: T[], existing: string[], threshold = 0.8): T[] {
  const kept: T[] = [];
  for (const it of items) {
    if ([...existing, ...kept.map((k) => k.text)].some((t) => similarity(t, it.text) >= threshold)) continue;
    kept.push(it);
  }
  return kept;
}

export async function generateCategory(client: ParseClient, world: GrandmaWorld, category: keyof typeof CATEGORIES, n: number, model: string = MODELS.qgen) {
  const memories = world.facts.map((f) => `${f.id}${f.year ? ` (${f.year})` : ""}: ${f.text}`).join("\n");
  const r = await structured(client, {
    model,
    system: "You write test questions for evaluating an LLM character. Questions sound like a grandchild talking to their grandma: casual, varied, sometimes vague. Use only the memory ids given.",
    user: `MEMORIES:\n${memories}\n\nWrite ${n} questions in the category "${category}": ${CATEGORIES[category]}. For each, list in "expect" the memory ids a good answer would use.`,
    schema: Generated,
    effort: "medium",
    maxTokens: 8000,
  });
  const ids = new Set(world.facts.map((f) => f.id));
  const items = (r.output?.items ?? []).map((it) => ({
    ...it,
    category,
    expect: it.expect?.filter((id) => ids.has(id)),
    qualifier: it.qualifier && ids.has(it.qualifier) ? it.qualifier : undefined,
  }));
  return { items, usage: r.usage };
}

async function main() {
  const per = Number(arg("per-category", "30"));
  const cats = Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[];
  console.log(`Q-bank generation with ${MODELS.qgen}: ${per} per category × ${cats.length} categories (${cats.length} calls).`);
  if (!process.argv.includes("--yes")) {
    console.log("This calls Claude Opus and costs money. Re-run with --yes to go ahead.");
    return;
  }
  const world = loadGameData(join(REPO_ROOT, "data")).worlds.get("rosie")!;
  const existing = (JSON.parse(readFileSync(join(REPO_ROOT, "eval/data/rosie-qbank.v1.json"), "utf8")) as { items: { text: string }[] }).items.map((i) => i.text);
  const client = realClient();
  const all: { text: string }[] = [];
  for (const c of cats) {
    const { items } = await generateCategory(client, world, c, per);
    all.push(...dedupe(items, [...existing, ...all.map((a) => a.text)]));
    process.stdout.write(".");
  }
  const file = join(REPO_ROOT, "eval/data", `rosie-qbank.generated-${stamp()}.json`);
  writeFileSync(file, JSON.stringify({ version: 1, reviewed: false, generator: MODELS.qgen, notes: "Spot-check before merging into the bank (eval plan §1).", items: all.map((it, i) => ({ id: `g${String(i + 1).padStart(3, "0")}`, ...it })) }, null, 2) + "\n");
  console.log(`\nWrote ${all.length} unreviewed questions: ${file}`);
}

if (process.argv[1]?.endsWith("qgen.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
