/**
 * Batch evaluation runner (docs/04-evaluation-plan.md §1–§5, §8).
 *
 *   npm run eval -- [--brain mock|llm] [--validate on|off] [--effort low|medium|high]
 *                   [--set qbank|redteam|all] [--recipes easy,medium,hard] [--limit N] [--yes]
 *                   [--model <id>] [--concurrency N]
 *
 * --model overrides GRANDMA_MODEL for a model comparison (docs/13-model-choice.md); --concurrency runs that many
 * visits at once (each visit's turns stay in order).
 *
 * Every question runs in a fresh visit (follow-ups replay their `after` turns first), on each recipe,
 * through the same turn logic as the server: password requests are deflected before the model; everything
 * else goes through the brain with the validator. Results go to eval/results/*.jsonl and a Markdown
 * report to eval/reports/. LLM runs cost money, so they need --yes and only use the key in the repo's .env.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asksForHarm, asksForPassword, createRunState, hashString, mentionsSelfHarm, pick, rng } from "@gwp/engine";
import type { GrandmaWorld, Recipe, RunState } from "@gwp/engine";
import { loadGameData } from "../../apps/server/src/data.ts";
import { REPO_ROOT, loadEnv, readConfig } from "../../apps/server/src/config.ts";
import { LlmBrain, MockBrain } from "../../apps/server/src/grandma.ts";
import { openRouterModel } from "../../apps/server/src/openrouter.ts";
import type { GrandmaBrain } from "../../apps/server/src/grandma.ts";
import type { TurnRecord } from "./metrics.ts";
import { writeAblationReport, writeReport } from "./report.ts";

interface QItem {
  id: string;
  category?: string;
  kind?: string;
  text: string;
  after?: string[];
  expect?: string[];
  qualifier?: string;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const opts = {
  brain: arg("brain", "mock") as "mock" | "llm",
  validate: arg("validate", "on") !== "off",
  effort: arg("effort", "low") as "low" | "medium" | "high",
  set: arg("set", "all"),
  recipes: arg("recipes", "easy,medium,hard").split(","),
  limit: Number(arg("limit", "0")) || Infinity,
  ablate: process.argv.includes("--ablate"),
  context: arg("context", "full") as "full" | "retrieval",
  yes: process.argv.includes("--yes"),
  model: arg("model", ""),
  concurrency: Math.max(1, Number(arg("concurrency", "1")) || 1),
};

const data = loadGameData(join(REPO_ROOT, "data"));
const world: GrandmaWorld = data.worlds.get("rosie")!;
const recipes = world.recipes.filter((r) => opts.recipes.includes(r.difficulty));
const lines = data.strings.grandma;

const load = (f: string) => (JSON.parse(readFileSync(join(REPO_ROOT, "eval/data", f), "utf8")) as { items: QItem[] }).items;
const sets: { name: "qbank" | "redteam"; items: QItem[] }[] = [];
if (opts.set === "qbank" || opts.set === "all") sets.push({ name: "qbank", items: load("rosie-qbank.v1.json").slice(0, opts.limit) });
if (opts.set === "redteam" || opts.set === "all") sets.push({ name: "redteam", items: load("redteam.v1.json").slice(0, opts.limit) });

function makeBrain(validate = opts.validate, effort = opts.effort, context = opts.context): GrandmaBrain {
  if (opts.brain === "mock") return new MockBrain({ validate });
  // Only the project's .env key, never one from the shell environment (same rule as the server).
  const config = readConfig({}, loadEnv());
  if (!config.apiKey) throw new Error("No OPENROUTER_API_KEY or ANTHROPIC_API_KEY in the repo's .env; LLM eval runs need the course key there.");
  const model = opts.model ? (config.provider === "openrouter" ? openRouterModel(opts.model) : opts.model) : config.grandmaModel;
  return new LlmBrain(model, { apiKey: config.apiKey, baseURL: config.apiBaseUrl, provider: config.provider }, { validate, effort, context });
}

/** One turn through the same logic as the server's /ask. */
async function turn(brain: GrandmaBrain, recipe: Recipe, run: RunState, text: string) {
  if (mentionsSelfHarm(text)) {
    return { reply: lines.crisis[0] ?? "", factIds: [] as string[], mood: "worried", source: "deflect" as const, attempts: 0, validatorErrors: [], latencyMs: 0 };
  }
  if (lines.harm && asksForHarm(text)) {
    const reply = pick(lines.harm, rng(hashString(`${run.id}:${run.questionCount}`)));
    return { reply, factIds: [] as string[], mood: "worried", source: "deflect" as const, attempts: 0, validatorErrors: [], latencyMs: 0 };
  }
  if (asksForPassword(text)) {
    const reply = pick(lines.password_deflect, rng(hashString(`${run.id}:${run.questionCount}`)));
    return { reply, factIds: [] as string[], mood: "suspicious", source: "deflect" as const, attempts: 0, validatorErrors: [], latencyMs: 0 };
  }
  const r = await brain.reply({ world, recipe, run, input: { kind: "ask", text }, lines });
  run.history.push({ role: "player", text }, { role: "grandma", text: r.output.reply, factIds: r.output.fact_ids_used, mood: r.output.mood });
  if (r.output.fact_ids_used.length) run.lastFactIds = r.output.fact_ids_used;
  run.questionCount++;
  return {
    reply: r.output.reply,
    factIds: r.output.fact_ids_used,
    mood: r.output.mood,
    source: r.fallback ? ("fallback" as const) : ("model" as const),
    attempts: r.attempts,
    validatorErrors: r.validatorErrors,
    latencyMs: r.latencyMs,
    usage: r.usage,
  };
}

async function runAll(brain: GrandmaBrain, which: typeof sets): Promise<TurnRecord[]> {
  const jobs = recipes.flatMap((recipe) => which.flatMap((set) => set.items.map((q) => ({ recipe, set, q }))));
  const records: (TurnRecord | undefined)[] = new Array(jobs.length);
  let next = 0;
  let done = 0;
  // A small pool: each visit's turns stay in order; results keep the job order whatever finishes first.
  const worker = async () => {
    for (let i = next++; i < jobs.length; i = next++) {
      const { recipe, set, q } = jobs[i]!;
      const run = createRunState({ id: `eval-${recipe.id}-${q.id}`, world, recipe, sceneId: data.sceneForWorld.get(world.id)!, greeting: "" });
      for (const prior of q.after ?? []) await turn(brain, recipe, run, prior);
      const t = await turn(brain, recipe, run, q.text);
      records[i] = { set: set.name, id: q.id, category: q.category ?? q.kind ?? "other", recipeId: recipe.id, question: q.text, expect: q.expect, qualifier: q.qualifier, ...t };
      if (++done % 20 === 0) process.stdout.write(".");
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, jobs.length) }, worker));
  console.log();
  return records.filter((r): r is TurnRecord => r !== undefined);
}

/** The plan's ablation configs that make sense for this brain. */
async function ablate() {
  const configs =
    opts.brain === "mock"
      ? [
          { config: "mock-A0", validator: false, effort: "n/a" },
          { config: "mock-A1", validator: true, effort: "n/a" },
        ]
      : [
          { config: "llm-A0", validator: false, effort: "low" },
          { config: "llm-A1", validator: true, effort: "low" },
          { config: "llm-A2", validator: true, effort: "medium" },
          { config: "llm-B1", validator: true, effort: "low", context: "retrieval" as const },
          { config: "llm-B2", validator: true, effort: "medium", context: "retrieval" as const },
        ];
  const qbank = sets.filter((s) => s.name === "qbank");
  const calls = qbank.reduce((n, s) => n + s.items.reduce((m, q) => m + 1 + (q.after?.length ?? 0), 0), 0) * recipes.length * configs.length;
  console.log(`Ablation ${configs.map((c) => c.config).join(", ")}: ${calls} turns`);
  if (opts.brain === "llm" && !opts.yes) {
    console.log(`This calls the model about ${calls}× (more with retries) and costs money. Re-run with --yes to go ahead.`);
    return;
  }
  const rows = [];
  for (const c of configs) {
    const brain = makeBrain(c.validator, (c.effort === "n/a" ? "low" : c.effort) as "low" | "medium" | "high", ("context" in c ? c.context : "full") as "full" | "retrieval");
    rows.push({ ...c, records: await runAll(brain, qbank) });
  }
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const file = writeAblationReport({ world, recipes, rows, stamp, brainLabel: opts.brain === "mock" ? "mock (keyword retrieval)" : readConfig({}, loadEnv()).grandmaModel });
  console.log(`Report: ${file}`);
}

async function main() {
  if (opts.ablate) return ablate();
  const calls = sets.reduce((n, s) => n + s.items.reduce((m, q) => m + 1 + (q.after?.length ?? 0), 0), 0) * recipes.length;
  const modelTag = opts.model ? `-${opts.model.replace(/^.*\//, "").replace(/[^a-z0-9.-]/gi, "")}` : "";
  const config = `${opts.brain}-${opts.validate ? "val" : "noval"}${opts.brain === "llm" ? `-${opts.effort}-${opts.context}` : ""}${modelTag}`;
  console.log(`Eval ${config}: ${sets.map((s) => `${s.name} ${s.items.length}`).join(", ")} × ${recipes.length} recipes = ${calls} turns`);
  if (opts.brain === "llm" && !opts.yes) {
    console.log(`This calls the model about ${calls}× (up to ${calls * 2} with retries) and costs money. Re-run with --yes to go ahead.`);
    return;
  }
  const brain = makeBrain();
  const records = await runAll(brain, sets);

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  mkdirSync(join(REPO_ROOT, "eval/results"), { recursive: true });
  const resultsFile = join(REPO_ROOT, "eval/results", `${stamp}-${config}.jsonl`);
  writeFileSync(resultsFile, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const reportFile = writeReport({ world, recipes, records, config, stamp, brainLabel: brain.model ?? "mock (keyword retrieval)", options: opts });
  console.log(`Results: ${resultsFile}\nReport:  ${reportFile}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
