/**
 * Question probes against the offline Grandma (review 44, docs/10-design-rescore.md). Free: no model calls.
 *
 * - reach: routes the chain maps promise ("When were you born?" → 1940). Each must work in every run;
 *   Vitest checks them, so a retrieval change can't quietly break a nudge or an object route again.
 * - obvious: the ten most direct questions per puzzle. The report says, per answer part, how often a single
 *   reply hands it over whole, and whether the puzzle falls to direct questions alone (rubric dimension 1).
 *
 * `npm run eval:probe` (optional: `-- --runs 24`) prints the report as Markdown.
 * Replies go through the validator like on the server; a rejected reply counts as "nothing given".
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SceneManifest, mockGrandmaReply, parseWorld, recipeById, slotParts, validateReply, validationContext } from "@gwp/engine";
import type { GrandmaWorld, Recipe, TurnInput } from "@gwp/engine";

export interface ReachProbe {
  recipe: string;
  ask?: string;
  show?: string;
  /** Text the reply must contain (case-insensitive). */
  expect: string;
  /** Memories she told in her last reply (the server passes these as lastFactIds). */
  after?: string[];
}

export interface ProbeFile {
  version: string;
  notes: string;
  reach: ReachProbe[];
  obvious: Record<string, string[]>;
}

export interface ReachResult extends ReachProbe {
  hits: number;
  runs: number;
  sample: string;
}

export interface PartResult {
  answer: string;
  /** The question that gave this part most often, and in how many runs. */
  best?: { question: string; hits: number };
}

export interface ObviousResult {
  recipe: string;
  password: string;
  runs: number;
  parts: PartResult[];
  /** Every part is given whole by some direct question in at least half the runs. */
  fallsToDirectQuestions: boolean;
  rejected: number;
}

/**
 * A content proposal, applied in memory only (the real data files never change): reword memories, add
 * anchors (a phrase she says instead of a year, which hides the year from her for that puzzle, as on Hard),
 * put a recipe's slot behind an anchor, and adjust the probes that the change moves. Used to show the team
 * what a proposed puzzle change does before anyone edits data/ (review 44, F2).
 */
export interface WorldPatch {
  id: string;
  notes: string;
  /** Set once the team adopts it into data/ (then it is a record, not something to apply again). */
  status?: string;
  /** New wording; misremembers: null drops a self-correction (a hidden year can't have one). */
  facts?: Record<string, { text?: string; misremembers?: number | null }>;
  anchors_add?: Record<string, unknown>[];
  recipes?: Record<string, { anchor_slots?: Record<string, string>; separate_add?: string[][] }>;
  reach_add?: ReachProbe[];
  reach_remove?: { recipe: string; ask?: string; show?: string }[];
}

const here = dirname(fileURLToPath(import.meta.url));
export const loadProbes = (): ProbeFile => JSON.parse(readFileSync(join(here, "../data/probes.v1.json"), "utf8")) as ProbeFile;
export const loadWorldJson = (): Record<string, unknown> => JSON.parse(readFileSync(join(here, "../../data/grandmas/rosie.json"), "utf8")) as Record<string, unknown>;
export const loadWorld = (): GrandmaWorld => parseWorld(loadWorldJson());

/** The patched world (validated, with the data's cross-checks) and the probes adjusted for it. */
export function applyPatch(worldJson: Record<string, unknown>, probes: ProbeFile, patch: WorldPatch): { world?: GrandmaWorld; problems: string[]; probes: ProbeFile } {
  const json = patchWorldJson(worldJson, patch);
  const same = (a: { recipe: string; ask?: string; show?: string }, b: typeof a) => a.recipe === b.recipe && a.ask === b.ask && a.show === b.show;
  const reach = probes.reach.filter((p) => !(patch.reach_remove ?? []).some((r) => same(p, r))).concat(patch.reach_add ?? []);
  try {
    // parseWorld runs the same schema and cross-checks as npm run validate, and throws on any problem.
    return { world: parseWorld(json), problems: [], probes: { ...probes, reach } };
  } catch (e) {
    return { problems: (e as Error).message.split("\n- ").slice(1), probes: { ...probes, reach } };
  }
}

/** The world file's JSON with a patch applied (a copy; used to measure a proposal, and to adopt one). */
export function patchWorldJson(worldJson: Record<string, unknown>, patch: WorldPatch): Record<string, unknown> {
  const json = structuredClone(worldJson) as { facts: { id: string; text: string; misremembers?: number }[]; anchors?: unknown[]; recipes: { id: string; slots: { requires_anchor?: string }[]; separate?: string[][] }[] };
  for (const [id, change] of Object.entries(patch.facts ?? {})) {
    const fact = json.facts.find((f) => f.id === id);
    if (!fact) throw new Error(`patch ${patch.id}: no fact ${id}`);
    if (change.text !== undefined) fact.text = change.text;
    if (change.misremembers === null) delete fact.misremembers;
    else if (change.misremembers !== undefined) fact.misremembers = change.misremembers;
  }
  json.anchors = [...(json.anchors ?? []), ...(patch.anchors_add ?? [])];
  for (const [id, change] of Object.entries(patch.recipes ?? {})) {
    const recipe = json.recipes.find((r) => r.id === id);
    if (!recipe) throw new Error(`patch ${patch.id}: no recipe ${id}`);
    for (const [i, anchor] of Object.entries(change.anchor_slots ?? {})) recipe.slots[Number(i)]!.requires_anchor = anchor;
    if (change.separate_add) recipe.separate = [...(recipe.separate ?? []), ...change.separate_add];
  }
  return json;
}
export const loadScene = (): SceneManifest => SceneManifest.parse(JSON.parse(readFileSync(join(here, "../../data/scenes/rosie-living-room.json"), "utf8")));

/** One reply as the server would send it: the mock's words if the validator passes them, else nothing. */
function reply(world: GrandmaWorld, recipe: Recipe, input: TurnInput, seed: string, recentFactIds: readonly string[] = []): { text: string; rejected: boolean } {
  const out = mockGrandmaReply({ world, recipe, input, seed, recentFactIds });
  const errors = validateReply(world, out, validationContext(world, recipe));
  return errors.length ? { text: "", rejected: true } : { text: out.reply, rejected: false };
}

function inputFor(p: { ask?: string; show?: string }, scene: SceneManifest): TurnInput {
  if (p.ask !== undefined) return { kind: "ask", text: p.ask };
  const o = scene.interactables.find((i) => i.id === p.show);
  if (!o) throw new Error(`probe: no object ${p.show}`);
  return { kind: "show", object: { id: o.id, label: o.label, inspectText: o.inspect_text ?? "", factIds: o.fact_ids ?? [] } };
}

const recipeOf = (world: GrandmaWorld, id: string): Recipe => {
  const r = recipeById(world, id);
  if (!r) throw new Error(`probe: no recipe ${id}`);
  return r;
};

export function runReach(world: GrandmaWorld, scene: SceneManifest, probes: readonly ReachProbe[], runs = 12): ReachResult[] {
  return probes.map((p) => {
    const recipe = recipeOf(world, p.recipe);
    const input = inputFor(p, scene);
    let hits = 0;
    let sample = "";
    for (let i = 0; i < runs; i++) {
      const r = reply(world, recipe, input, `probe:${i}:${p.ask ?? p.show}`, p.after);
      if (r.text.toLowerCase().includes(p.expect.toLowerCase())) hits++;
      sample ||= r.text;
    }
    return { ...p, hits, runs, sample };
  });
}

const wholeWord = (needle: string) => new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

export function runObvious(world: GrandmaWorld, obvious: Record<string, string[]>, runs = 12): ObviousResult[] {
  return Object.entries(obvious).map(([id, questions]) => {
    const recipe = recipeOf(world, id);
    const answers = slotParts(world, recipe);
    let rejected = 0;
    const parts: PartResult[] = answers.map((answer) => ({ answer }));
    for (const q of questions) {
      const hits = answers.map(() => 0);
      for (let i = 0; i < runs; i++) {
        const r = reply(world, recipe, { kind: "ask", text: q }, `obvious:${i}:${q}`);
        if (r.rejected) rejected++;
        answers.forEach((a, j) => wholeWord(a).test(r.text) && hits[j]!++);
      }
      parts.forEach((p, j) => {
        if (hits[j]! > (p.best?.hits ?? 0)) p.best = { question: q, hits: hits[j]! };
      });
    }
    const fallsToDirectQuestions = parts.every((p) => (p.best?.hits ?? 0) * 2 >= runs);
    return { recipe: id, password: answers.join(""), runs, parts, fallsToDirectQuestions, rejected };
  });
}

export function renderReport(reach: ReachResult[], obvious: ObviousResult[]): string {
  const lines = ["# Question probes (offline Grandma)", ""];
  const failed = reach.filter((r) => r.hits < r.runs);
  lines.push(`## Reach: ${reach.length - failed.length}/${reach.length} routes work in every run`, "");
  lines.push("| Puzzle | Probe | Expect | Hits |", "|---|---|---|---|");
  for (const r of reach) lines.push(`| ${r.recipe} | ${r.ask ? `"${r.ask}"` : `show ${r.show}`} | ${r.expect} | ${r.hits}/${r.runs}${r.hits < r.runs ? " ✗" : ""} |`);
  const falls = obvious.filter((o) => o.fallsToDirectQuestions);
  lines.push("", `## Direct questions: ${falls.length}/${obvious.length} puzzles fall to them alone`, "");
  lines.push("A part \"falls\" when one direct question hands it over whole in at least half the runs. Easy may allow one such part; every part falling means no deduction.", "");
  lines.push("| Puzzle | Password | Part | Best direct question | Runs | Falls? |", "|---|---|---|---|---|---|");
  for (const o of obvious) {
    o.parts.forEach((p, i) => {
      const best = p.best ? `"${p.best.question}"` : "none";
      lines.push(`| ${i ? "" : o.recipe} | ${i ? "" : o.password} | ${p.answer} | ${best} | ${p.best?.hits ?? 0}/${o.runs} | ${i ? "" : o.fallsToDirectQuestions ? "**yes**" : "no"} |`);
    });
  }
  return lines.join("\n");
}

/** Before/after for a patch: which puzzles stop falling to direct questions. */
export function renderComparison(before: ObviousResult[], after: ObviousResult[]): string {
  const lines = ["## Before and after", "", "| Puzzle | Falls to direct questions now | With the patch |", "|---|---|---|"];
  for (const b of before) {
    const a = after.find((x) => x.recipe === b.recipe)!;
    lines.push(`| ${b.recipe} | ${b.fallsToDirectQuestions ? "yes" : "no"} | ${a.fallsToDirectQuestions ? "yes" : "**no**"} |`);
  }
  const count = (rs: ObviousResult[]) => rs.filter((r) => r.fallsToDirectQuestions).length;
  lines.push("", `Falling puzzles: ${count(before)}/${before.length} now, ${count(after)}/${after.length} with the patch.`);
  return lines.join("\n");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("eval/src/probe.ts")) {
  const arg = (name: string) => {
    const at = process.argv.indexOf(name);
    return at > 0 ? process.argv[at + 1] : undefined;
  };
  const runs = Number(arg("--runs") ?? 12);
  const probes = loadProbes();
  const patchFile = arg("--patch");
  if (patchFile) {
    // `npm run eval:probe -- --patch eval/data/proposals/<file>.json`: measure a content proposal in memory.
    const patch = JSON.parse(readFileSync(patchFile, "utf8")) as WorldPatch;
    const patched = applyPatch(loadWorldJson(), probes, patch);
    console.log(`# Proposal ${patch.id}\n\n${patch.notes}\n`);
    if (!patched.world) {
      console.log(`**Data problems (fix the patch first):**\n${patched.problems.map((p) => `- ${p}`).join("\n")}`);
      process.exit(1);
    }
    console.log("Data cross-checks (as in npm run validate): pass.\n");
    const reach = runReach(patched.world, loadScene(), patched.probes.reach, runs);
    const after = runObvious(patched.world, probes.obvious, runs);
    console.log(renderComparison(runObvious(loadWorld(), probes.obvious, runs), after) + "\n");
    console.log(renderReport(reach, after).replace("# Question probes (offline Grandma)", "# With the patch"));
    if (reach.some((r) => r.hits < r.runs)) process.exitCode = 1;
  } else {
    const world = loadWorld();
    const reach = runReach(world, loadScene(), probes.reach, runs);
    console.log(renderReport(reach, runObvious(world, probes.obvious, runs)));
    if (reach.some((r) => r.hits < r.runs)) process.exitCode = 1;
  }
}
