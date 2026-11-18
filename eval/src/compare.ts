/**
 * Side-by-side table of several eval result files (a model comparison, docs/13-model-choice.md).
 *
 *   npx tsx eval/src/compare.ts eval/results/<a>.jsonl eval/results/<b>.jsonl … [--redteam-only]
 *
 * Free: it only reads files. --redteam-only compares the attack set alone, so arms that ran different sets line up.
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { loadGameData } from "../../apps/server/src/data.ts";
import { REPO_ROOT } from "../../apps/server/src/config.ts";
import { summarize } from "./metrics.ts";
import type { TurnRecord } from "./metrics.ts";

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const redteamOnly = process.argv.includes("--redteam-only");
const world = loadGameData(join(REPO_ROOT, "data")).worlds.get("rosie")!;
const recipes = new Map(world.recipes.map((r) => [r.id, r]));
const pct = (x: number | null) => (x === null ? "–" : `${(x * 100).toFixed(1)}%`);
const ms = (x: number | null) => (x === null ? "–" : `${(x / 1000).toFixed(2)} s`);

const rows = files.map((f) => {
  let turns = readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l) as TurnRecord);
  if (redteamOnly) turns = turns.filter((t) => t.set === "redteam");
  const s = summarize(world, recipes, turns, new Date().getFullYear());
  const errors = turns.flatMap((t) => t.validatorErrors ?? []);
  const noJson = errors.filter((e) => /no parseable output/.test(e)).length;
  return { name: basename(f).replace(/^\d{4}-\d\d-\d\d-\d\d-\d\d-/, "").replace(/\.jsonl$/, ""), s, noJson, spend: turns.reduce((n, t) => n + (t.usage?.costUsd ?? 0), 0) };
});

const line = (label: string, get: (r: (typeof rows)[number]) => string) => `| ${label} | ${rows.map(get).join(" | ")} |`;
console.log(
  [
    `| Metric | ${rows.map((r) => r.name).join(" | ")} |`,
    `|---|${rows.map(() => "---").join("|")}|`,
    line("Turns (sent to the model)", (r) => `${r.s.turns} (${r.s.modelTurns})`),
    line("Leaks (target 0)", (r) => pct(r.s.leakRate)),
    line("Contradictions, rule-based (< 2%)", (r) => pct(r.s.contradictionRate)),
    line("Invented details, rule-based", (r) => pct(r.s.inventedRate)),
    line("Hidden year said", (r) => pct(r.s.hiddenYearRate)),
    line("Joined two parts", (r) => pct(r.s.joinedRate)),
    line("Recall (right memory)", (r) => pct(r.s.recall)),
    line("Confusable fairness", (r) => pct(r.s.confusableFairness)),
    line("Retried (validator)", (r) => pct(r.s.retryRate)),
    line("Fell back (no usable reply)", (r) => pct(r.s.fallbackRate)),
    line("No valid JSON (attempts)", (r) => String(r.noJson)),
    line("Latency p50", (r) => ms(r.s.p50)),
    line("Latency p95", (r) => ms(r.s.p95)),
    line("Cost per model turn", (r) => `$${r.s.costPerTurn.toFixed(5)}`),
    line("Spent on this arm", (r) => `$${r.spend.toFixed(3)}`),
  ].join("\n"),
);
