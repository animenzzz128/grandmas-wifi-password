/**
 * How OpenRouter's reasoning setting changes a model's hidden tokens, latency and cost on Grandma's turns
 * (iteration 62: Haiku through OpenRouter thought before answering by default; Anthropic direct didn't).
 *
 *   npx tsx eval/src/probe-reasoning.ts [model] [--yes]
 *
 * 8 questions × 5 settings = 40 calls; about $0.02 on Haiku. Costs money, so it needs --yes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { createRunState } from "@gwp/engine";
import { REPO_ROOT, loadEnv, readConfig } from "../../apps/server/src/config.ts";
import { loadGameData } from "../../apps/server/src/data.ts";
import { LlmBrain } from "../../apps/server/src/grandma.ts";
import { openRouterClient } from "../../apps/server/src/openrouter.ts";

const config = readConfig({}, loadEnv());
if (config.provider !== "openrouter" || !config.apiKey) throw new Error("This probe needs an OpenRouter key in .env.");
const data = loadGameData(join(REPO_ROOT, "data"));
const world = data.worlds.get("rosie")!;
const recipe = world.recipes.find((r) => r.id === "r_easy")!;
const items = JSON.parse(readFileSync(join(REPO_ROOT, "eval/data/rosie-qbank.v1.json"), "utf8")).items as { text: string; after?: string[] }[];
const qs = items.filter((q) => !q.after).slice(0, 8).map((q) => q.text);
const model = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "anthropic/claude-haiku-5.5";
const variants: [string, unknown][] = [
  ["omitted", undefined],
  ["none", { effort: "none" }],
  ["minimal", { effort: "minimal" }],
  ["low", { effort: "low" }],
  ["disabled", { enabled: false }],
];

if (!process.argv.includes("--yes")) {
  console.log(`${qs.length * variants.length} calls to ${model}; costs money. Re-run with --yes.`);
} else {
  for (const [name, reasoning] of variants) {
    const withSetting = (async (url: string, init: RequestInit) => {
      const { reasoning: _old, ...body } = JSON.parse(String(init.body)) as Record<string, unknown>;
      return fetch(url, { ...init, body: JSON.stringify(reasoning ? { ...body, reasoning } : body) });
    }) as typeof fetch;
    const client = openRouterClient({ apiKey: config.apiKey, timeoutMs: 20_000, fetch: withSetting }) as unknown as Anthropic;
    const brain = new LlmBrain(model, { client });
    const rows = await Promise.all(
      qs.map((text, i) => brain.reply({ world, recipe, run: createRunState({ id: `p-${name}-${i}`, world, recipe, sceneId: "s", greeting: "" }), input: { kind: "ask", text }, lines: data.strings.grandma })),
    );
    const lat = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
    const out = rows.reduce((s, r) => s + (r.usage?.output ?? 0), 0) / rows.length;
    const cost = rows.reduce((s, r) => s + (r.usage?.costUsd ?? 0), 0);
    console.log(
      `${name.padEnd(9)} median ${(lat[Math.floor(lat.length / 2)]! / 1000).toFixed(2)} s · max ${(lat.at(-1)! / 1000).toFixed(2)} s · out ${out.toFixed(0)} tok · fallbacks ${rows.filter((r) => r.fallback).length} · retries ${rows.filter((r) => r.attempts > 1).length} · $${cost.toFixed(4)}`,
    );
  }
}
