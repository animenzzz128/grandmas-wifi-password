/**
 * The note generator (docs/15): a world's part bank becomes its notes. Every (word part, number part) pair that
 * fits a difficulty tier and passes the conflict rules below becomes a Recipe, the same object the rest of the
 * engine has always used, so the validator, the offline Grandma, topic cards and the chain tests work unchanged.
 *
 * All the notes are made when the world loads, not per visit: a visit draws one of its tier's notes at random,
 * and the tests can check every note there is. Ids say what a note is made of ("medium:street_tv+painted_number"),
 * so saved visits, the daily and the logs keep working as long as the parts exist.
 */
import type { Difficulty, GrandmaWorld, GrandmaWorldData, Part, Recipe, Tier } from "./world.ts";
import { GrandmaWorld as GrandmaWorldSchema, checkWorld, computePassword, containsAllSlots, hiddenYears, saysValue, slotParts } from "./world.ts";
import { hashString } from "./text.ts";

export const TIERS = ["easy", "medium", "hard"] as const;
export type TierName = (typeof TIERS)[number];

/** A part's points: its hops, plus one when a step needs the room. */
export const partPoints = (p: Part): number => p.hops + (p.needs_room ? 1 : 0);

/** The rules every note shows. Parts may add their own. */
const BASE_RULES = ["no spaces", "first letter capital"];

/** The id of a generated note. */
export const noteId = (tier: string, word: string, number: string, suffix = "") => `${tier}:${word}+${number}${suffix}`;

/** The two part ids a note is made of, from its id or its alias ("r_easy" → sock_thief, wedding_year). */
export function partsOf(world: Pick<GrandmaWorldData, "aliases">, recipeId: string): [string, string] | undefined {
  const alias = world.aliases?.[recipeId];
  if (alias) return alias.parts;
  const m = /^[a-z]+:([a-z0-9_]+)\+([a-z0-9_]+)/.exec(recipeId);
  return m ? [m[1]!, m[2]!] : undefined;
}

const says = saysValue;

type World = Omit<GrandmaWorldData, "recipes"> & { recipes?: Recipe[] };

const asWorld = (w: World): GrandmaWorld => ({ ...w, recipes: w.recipes ?? [] }) as GrandmaWorld;

/** The answer a part puts on the router ("Biscuit", "1961"). */
function answerOf(world: World, part: Part): string {
  const probe: Recipe = { id: part.id, difficulty: "easy", note_text: part.line, slots: [part.slot], format: { join: "" }, password: "" };
  return slotParts(asWorld(world), probe)[0]!;
}

/** Every text that comes with a part: its line, nudges, anchor phrase, and the memories its card and anchor tell. */
function partTexts(world: World, part: Part): string[] {
  const anchor = part.slot.requires_anchor ? world.anchors?.find((a) => a.id === part.slot.requires_anchor) : undefined;
  const factIds = [...(part.note_facts ?? [part.slot.fact_id]), ...(anchor?.via_fact_ids ?? [])];
  return [part.line, part.smudged ?? "", ...part.nudges, anchor?.phrase ?? "", ...factIds.map((id) => world.facts.find((f) => f.id === id)?.text ?? "")];
}

/** Facts that say a part's answer outright (its own fact, and any other memory that names it). */
function answerFacts(world: World, part: Part, answer: string): string[] {
  return world.facts.filter((f) => f.id === part.slot.fact_id || says(f.text, answer)).map((f) => f.id);
}

/** Why two parts can't share a note (empty: they can). Kind and tier are checked elsewhere. */
export function conflicts(world: World, word: Part, number: Part): string[] {
  const why: string[] = [];
  if (word.slot.fact_id === number.slot.fact_id && word.slot.field === number.slot.field) why.push("same slot");
  const a = answerOf(world, word);
  const b = answerOf(world, number);
  // Each part's texts must not say the other's answer: its card, nudge or anchor would hand it over.
  for (const t of partTexts(world, number)) if (t && says(t, a)) why.push(`${number.id} says "${a}"`);
  for (const t of partTexts(world, word)) if (t && says(t, b)) why.push(`${word.id} says "${b}"`);
  // A year the note hides must not be printed or spoken by the other part's line or nudges.
  const hidden = number.slot.requires_anchor ? world.anchors?.find((x) => x.id === number.slot.requires_anchor)?.resolves_to_year : undefined;
  if (hidden !== undefined) for (const t of [word.line, word.smudged ?? "", ...word.nudges]) if (says(t, String(hidden))) why.push(`${word.id} says the hidden ${hidden}`);
  return [...new Set(why)];
}

/** Does the pair fit the tier's point rules? */
export function fitsTier(tier: Tier, word: Part, number: Part): boolean {
  const pts = [partPoints(word), partPoints(number)];
  const total = pts[0]! + pts[1]!;
  if (total < tier.points[0] || total > tier.points[1]) return false;
  if (tier.max_part !== undefined && Math.max(...pts) > tier.max_part) return false;
  if (tier.min_top_part !== undefined && Math.max(...pts) < tier.min_top_part) return false;
  const room = Boolean(word.needs_room || number.needs_room);
  if (tier.room === "none" && room) return false;
  if (tier.room === "required" && !room) return false;
  return true;
}

/** Put two parts together as a note of `difficulty`. No legality checks (see generateRecipes). */
export function composeRecipe(world: World, difficulty: Difficulty, word: Part, number: Part, opts: { id?: string; suffix?: string; tier?: Tier } = {}): Recipe {
  const tier = opts.tier ?? (world.tiers as Record<string, Tier> | undefined)?.[difficulty];
  const suffixes = tier?.suffixes ?? [];
  const suffix = opts.suffix ?? (suffixes.length ? suffixes[hashString(`${word.id}+${number.id}`) % suffixes.length] : undefined);
  const parts = [word, number];
  const tail = suffix ? [suffix] : [];
  const smudged = tier?.smudge && parts.some((p) => p.smudged) ? [...parts.map((p) => p.smudged ?? p.line), ...tail].join(" + ") : undefined;

  // One reply may not hand over both parts: every memory that says one answer is kept apart from every memory
  // that says the other (Recipe.separate), on top of each part's own chain links.
  const a = answerFacts(world, word, answerOf(world, word));
  const b = answerFacts(world, number, answerOf(world, number));
  const separate: string[][] = [...(word.separate ?? []), ...(number.separate ?? [])];
  const key = (g: string[]) => [...g].sort().join("|");
  const seen = new Set(separate.map(key));
  for (const x of a)
    for (const y of b) {
      if (x === y) continue;
      const g = [x, y];
      if (!seen.has(key(g))) {
        seen.add(key(g));
        separate.push(g);
      }
    }

  // Nudges take turns between the parts, so a stuck player hears about each one.
  const nudges: string[] = [];
  for (let i = 0; i < Math.max(word.nudges.length, number.nudges.length); i++) {
    if (word.nudges[i]) nudges.push(word.nudges[i]!);
    if (number.nudges[i]) nudges.push(number.nudges[i]!);
  }

  const recipe: Recipe = {
    id: opts.id ?? noteId(difficulty, word.id, number.id, suffix ?? ""),
    difficulty,
    note_text: [...parts.map((p) => p.line), ...tail].join(" + "),
    ...(smudged ? { smudged_text: smudged } : {}),
    slots: [word.slot, number.slot],
    ...(suffix ? { literal_suffix: suffix } : {}),
    separate,
    nudges,
    format: { join: "", rules_shown_on_note: [...new Set([...BASE_RULES, ...(word.rules ?? []), ...(number.rules ?? [])])] },
    password: "",
    par: tier?.par ?? null,
    note_facts: parts.map((p) => p.note_facts ?? [p.slot.fact_id]),
  };
  recipe.password = computePassword(asWorld(world), recipe);
  return recipe;
}

/**
 * Why a composed note can't be played (empty: it can): one memory or story says the whole answer, or it hides the
 * year of a memory she is allowed to misremember (her self-correction would say it).
 */
export function noteProblems(world: World, recipe: Recipe): string[] {
  const w = asWorld(world);
  const why: string[] = [];
  for (const f of world.facts) if (containsAllSlots(w, recipe, f.text)) why.push(`${f.id} says the whole answer`);
  for (const s of world.stories ?? []) if (containsAllSlots(w, recipe, s.text)) why.push(`story ${s.id} says the whole answer`);
  const hidden = hiddenYears(w, recipe);
  for (const f of world.facts) if (f.misremembers !== undefined && f.year !== undefined && hidden.has(f.year)) why.push(`${f.id} misremembers a hidden year`);
  return why;
}

/** Every pair the tiers allow, with why the rest were left out (for `npm run validate` and the docs). */
export function generateRecipes(world: World): { recipes: Recipe[]; rejected: { id: string; why: string[] }[] } {
  const recipes: Recipe[] = [];
  const rejected: { id: string; why: string[] }[] = [];
  const parts = world.parts ?? [];
  const tiers = world.tiers;
  if (!parts.length || !tiers) return { recipes, rejected };
  const words = parts.filter((p) => p.kind === "word");
  const numbers = parts.filter((p) => p.kind === "number");
  for (const name of TIERS) {
    const tier = tiers[name];
    for (const w of words)
      for (const n of numbers) {
        if (!fitsTier(tier, w, n)) continue;
        const why = conflicts(world, w, n);
        const recipe = composeRecipe(world, name, w, n, { tier });
        why.push(...noteProblems(world, recipe));
        if (why.length) rejected.push({ id: recipe.id, why });
        else recipes.push(recipe);
      }
  }
  return { recipes, rejected };
}

/** The notes behind retired ids (aliases). */
function retiredRecipes(world: World): Recipe[] {
  const byId = new Map((world.parts ?? []).map((p) => [p.id, p]));
  const out: Recipe[] = [];
  for (const [id, a] of Object.entries(world.aliases ?? {})) {
    const w = byId.get(a.parts[0]);
    const n = byId.get(a.parts[1]);
    if (!w || !n) throw new Error(`alias ${id}: unknown part ${!w ? a.parts[0] : a.parts[1]}`);
    out.push(composeRecipe(world, a.tier, w, n, { id, suffix: a.suffix ?? "" }));
  }
  return out;
}

/** A world as data → a world with its notes: the fixed ones, then every generated one. */
export function expandWorld(data: GrandmaWorldData): GrandmaWorld {
  const { recipes } = generateRecipes(data);
  const world: GrandmaWorld = { ...data, recipes: [...(data.recipes ?? []), ...recipes] };
  if (data.aliases) world.retired = retiredRecipes(data);
  return world;
}

/** Parse and check a world file, and make its notes. */
export function parseWorld(json: unknown): GrandmaWorld {
  const world = expandWorld(GrandmaWorldSchema.parse(json));
  const problems = checkWorld(world);
  if (!world.recipes.length) problems.push("no notes: give the world recipes, or parts and tiers");
  for (const p of checkParts(world)) problems.push(p);
  if (problems.length) throw new Error(`world ${world.id} is invalid:\n- ${problems.join("\n- ")}`);
  return world;
}

/** Cross-reference checks for the part bank. */
export function checkParts(world: World): string[] {
  const problems: string[] = [];
  const factIds = new Set(world.facts.map((f) => f.id));
  const seen = new Set<string>();
  for (const p of world.parts ?? []) {
    if (seen.has(p.id)) problems.push(`duplicate part id ${p.id}`);
    seen.add(p.id);
    if (!factIds.has(p.slot.fact_id)) problems.push(`part ${p.id}: unknown fact ${p.slot.fact_id}`);
    for (const id of [...(p.note_facts ?? []), ...(p.decoys ?? []), ...(p.separate ?? []).flat()]) if (!factIds.has(id)) problems.push(`part ${p.id}: unknown fact ${id}`);
    if (p.slot.requires_anchor && !world.anchors?.some((a) => a.id === p.slot.requires_anchor)) problems.push(`part ${p.id}: unknown anchor ${p.slot.requires_anchor}`);
    if (p.line.includes("+")) problems.push(`part ${p.id}: a line can't contain "+" (it separates the note's parts)`);
    if (p.slot.hidden && !p.needs_room) problems.push(`part ${p.id}: a hidden answer needs the room (needs_room)`);
    if (p.slot.hidden && p.slot.requires_anchor) problems.push(`part ${p.id}: a hidden answer can't also hide behind an anchor`);
  }
  if (world.parts?.length && !world.tiers) problems.push("parts without tiers");
  return problems;
}
