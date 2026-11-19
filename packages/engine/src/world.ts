/**
 * The Grandma world: zod mirror of data/schema/grandma.schema.json, plus helpers.
 * Keep this file and the JSON Schema in sync (test/world.test.ts checks rosie.json against both).
 */
import { z } from "zod";

export const Difficulty = z.enum(["easy", "medium", "hard", "expert"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const Transform = z.enum(["none", "capitalize", "lowercase", "uppercase", "first_word"]);

const Profile = z.strictObject({
  name: z.string(),
  nickname: z.string().optional(),
  birth_year: z.number().int().min(1925).max(1960),
  hometown: z.string(),
  personality: z.strictObject({
    talkativeness: z.number().int().min(1).max(5),
    teasing: z.number().int().min(1).max(5),
    nostalgia: z.number().int().min(1).max(5),
    suspicion_of_kids_these_days: z.number().int().min(1).max(5),
  }),
  humor_style: z.string().optional(),
  verbal_tics: z.array(z.string()).min(1),
  /** Answers to small talk ("How are you?") for the offline Grandma: warm, no memories, a nudge back to the note. */
  small_talk: z.array(z.string()).optional(),
});

const Entity = z.strictObject({
  id: z.string(),
  type: z.enum(["person", "pet", "place", "object", "organization", "event"]),
  name: z.string(),
  aliases: z.array(z.string()).optional(),
  relation_to_player: z.string().optional(),
});

const Fact = z.strictObject({
  id: z.string(),
  subject: z.string(),
  predicate: z.string(),
  object: z.union([z.string(), z.number().int()]),
  year: z.number().int().optional(),
  text: z.string(),
  tags: z.array(z.string()).optional(),
  confusable_with: z.array(z.string()).optional(),
  disambiguator: z.string().optional(),
  /** A wrong year she sometimes says first and then corrects ("1962… no, '61"). GDD §3.2. */
  misremembers: z.number().int().optional(),
  salience: z.number().int().min(1).max(5),
});

const Anchor = z.strictObject({
  id: z.string(),
  phrase: z.string(),
  resolves_to_year: z.number().int(),
  via_fact_ids: z.array(z.string()).optional(),
  source: z.enum(["family", "public"]),
});

const Story = z.strictObject({
  id: z.string(),
  title: z.string(),
  fact_ids: z.array(z.string()).min(1),
  text: z.string(),
});

/**
 * A "little thing": everyday colour she may use to make a reply warmer or funnier (iteration 64). Not a clue and
 * never an answer: checkWorld keeps every answer word, digit, time phrase and new name out of it.
 */
const Colour = z.strictObject({
  id: z.string(),
  /** Entity ids it is about (for review, and so the judge and future retrieval can group them). */
  about: z.array(z.string()).min(1),
  text: z.string(),
});

const Slot = z.strictObject({
  fact_id: z.string(),
  field: z.enum(["object", "year"]),
  transform: Transform.optional(),
  requires_anchor: z.string().optional(),
  /**
   * Grandma doesn't remember this answer on this note: only the room shows it (a part that needs the room,
   * docs/15). Her memories that say it are left out of her mind for the note (forgetful), and the validator
   * rejects a reply that says it.
   */
  hidden: z.boolean().optional(),
});

const Recipe = z.strictObject({
  id: z.string(),
  difficulty: Difficulty,
  note_text: z.string(),
  smudged_text: z.string().optional(),
  slots: z.array(Slot).min(1),
  literal_suffix: z.string().optional(),
  /**
   * Groups of facts that form consecutive links of this recipe's inference chain. A single reply
   * may use at most one fact from each group, so one question can't jump a whole hop.
   */
  separate: z.array(z.array(z.string()).min(2)).optional(),
  /**
   * In-character lines Grandma says when the player is stuck (several turns that touch none of this
   * recipe's chain facts). Each points at the first hop: an object or a memory to ask about.
   */
  nudges: z.array(z.string()).optional(),
  format: z.strictObject({
    join: z.string(),
    rules_shown_on_note: z.array(z.string()).optional(),
  }),
  password: z.string(),
  par: z.number().int().nullable().optional(),
  /**
   * Topic cards (see topics.ts): for each part of the note (split at "+"), the memories Grandma tells when the
   * player taps that part's card. They point at the clue, not always the answer: on Medium and Hard a part
   * needs a hop.
   */
  note_facts: z.array(z.array(z.string())).optional(),
});

/**
 * A part of a password: one line of the sticky note with everything the puzzle needs for it (docs/15). The
 * generator (compose.ts) puts a word part and a number part together into a Recipe, for each difficulty tier
 * whose rules the pair meets, so every visit draws its note from the bank instead of from a fixed list.
 */
const Part = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/),
  /** word: a name, place or nickname; number: a year or a house number. A note has one of each. */
  kind: z.enum(["word", "number"]),
  /** The note's line for this part. */
  line: z.string(),
  /** The line with a smudge only the reading glasses read (used by tiers with `smudge`). */
  smudged: z.string().optional(),
  slot: Slot,
  /** Inference steps from the line to the answer (0: one direct question gives it; probe data). */
  hops: z.number().int().min(0).max(5),
  /** A step only an object in the room gives (counts one more point). */
  needs_room: z.boolean().optional(),
  /** Facts with a look-alike answer the player has to rule out (for review and the chain maps). */
  decoys: z.array(z.string()).optional(),
  /** What her topic card for this line tells (see Recipe.note_facts). Default: the slot's fact. */
  note_facts: z.array(z.string()).optional(),
  /** Consecutive links of this part's chain (see Recipe.separate). */
  separate: z.array(z.array(z.string()).min(2)).optional(),
  /** What she says when the player is stuck on this part. */
  nudges: z.array(z.string()).min(1),
  /** Extra rules printed on the note ("no 'Avenue'"). */
  rules: z.array(z.string()).optional(),
});

/** How a tier is put together, in points: a part's hops, plus one if it needs the room (docs/15). */
const Tier = z.strictObject({
  /** Total points of the two parts, inclusive. */
  points: z.tuple([z.number().int(), z.number().int()]),
  /** No part may have more points than this. */
  max_part: z.number().int().optional(),
  /** At least one part must have this many points. */
  min_top_part: z.number().int().optional(),
  /** Lines with a smudged version show it (the reading glasses read it). */
  smudge: z.boolean().optional(),
  /** Parts that need the room: "none" (talk only), "required" (at least one), or any (default). */
  room: z.enum(["none", "required", "any"]).optional(),
  /** A symbol on the end of the password, picked per note. */
  suffixes: z.array(z.string()).optional(),
  par: z.number().int().optional(),
});

/** A retired note id (saved visits, logs, tests) and the parts it is made of now. */
const Alias = z.strictObject({
  tier: Difficulty,
  parts: z.tuple([z.string(), z.string()]),
  suffix: z.string().optional(),
});

/**
 * A topic card the player can ask about (topics.ts). It appears once Grandma says one of its `match` phrases or
 * a clue mentions one; asking about it tells its memories in order.
 */
const Topic = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string(),
  kind: z.enum(["person", "pet", "place", "event", "thing"]),
  /** Words that unlock the card when Grandma or a clue says them (whole words; a plural "s" also counts). */
  match: z.array(z.string()).optional(),
  facts: z.array(z.string()).min(1),
});

/** A Grandma world as written in data/grandmas/*.json. parseWorld() adds the generated recipes (compose.ts). */
export const GrandmaWorld = z.strictObject({
  $schema: z.string().optional(),
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().min(1),
  seed: z.number().int().nullable().optional(),
  source: z.enum(["hand-written", "generated"]).optional(),
  profile: Profile,
  entities: z.array(Entity),
  facts: z.array(Fact).min(10),
  anchors: z.array(Anchor).optional(),
  stories: z.array(Story).optional(),
  /** Little things: colour, not clues (iteration 64). */
  colour: z.array(Colour).optional(),
  /** Fixed notes, if any. A world with parts gets its notes from the generator instead. */
  recipes: z.array(Recipe).optional(),
  /** The part bank (docs/15). */
  parts: z.array(Part).optional(),
  tiers: z.strictObject({ easy: Tier, medium: Tier, hard: Tier }).optional(),
  /** Retired note ids, rebuilt from parts (they need not meet a tier's rules). */
  aliases: z.record(z.string(), Alias).optional(),
  /** Topic cards. Without them, cards are made from the entities (topics.ts). */
  topics: z.array(Topic).optional(),
  /** Cards the player has from the start (besides the note's own parts). */
  start_topics: z.array(z.string()).optional(),
});

export type Topic = z.infer<typeof Topic>;
export type GrandmaWorldData = z.infer<typeof GrandmaWorld>;
/** A loaded world: the data plus every note the generator made from its parts (parseWorld). */
export type GrandmaWorld = Omit<GrandmaWorldData, "recipes"> & {
  recipes: Recipe[];
  /** Notes behind retired ids (aliases): found by recipeById, never drawn for a new visit. */
  retired?: Recipe[];
};
export type Part = z.infer<typeof Part>;
export type Tier = z.infer<typeof Tier>;
export type Fact = z.infer<typeof Fact>;
export type Entity = z.infer<typeof Entity>;
export type Recipe = z.infer<typeof Recipe>;
export type Anchor = z.infer<typeof Anchor>;

export function factById(world: GrandmaWorld, id: string): Fact | undefined {
  return world.facts.find((f) => f.id === id);
}

export function entityById(world: GrandmaWorld, id: string): Entity | undefined {
  return world.entities.find((e) => e.id === id);
}

export function recipeById(world: GrandmaWorld, id: string): Recipe | undefined {
  return world.recipes.find((r) => r.id === id) ?? world.retired?.find((r) => r.id === id);
}

/** Resolve a fact's object to a display string: an entity's name, or the literal value. */
export function objectValue(world: GrandmaWorld, fact: Fact): string {
  if (typeof fact.object === "number") return String(fact.object);
  return entityById(world, fact.object)?.name ?? fact.object;
}

function applyTransform(value: string, transform: z.infer<typeof Transform> = "none"): string {
  switch (transform) {
    case "capitalize":
      return value.charAt(0).toUpperCase() + value.slice(1);
    case "lowercase":
      return value.toLowerCase();
    case "uppercase":
      return value.toUpperCase();
    case "first_word":
      return value.split(/\s+/)[0] ?? value;
    case "none":
      return value;
  }
}

/** Compute the password a recipe describes, from the facts alone. */
export function computePassword(world: GrandmaWorld, recipe: Recipe): string {
  return slotParts(world, recipe).join(recipe.format.join) + (recipe.literal_suffix ?? "");
}

/** The value of each slot after its transform, e.g. ["Maple", "412"]. */
export function slotParts(world: GrandmaWorld, recipe: Recipe): string[] {
  return recipe.slots.map((slot) => {
    const fact = factById(world, slot.fact_id);
    if (!fact) throw new Error(`recipe ${recipe.id}: unknown fact ${slot.fact_id}`);
    let raw: string;
    if (slot.field === "year") {
      if (fact.year === undefined) throw new Error(`recipe ${recipe.id}: fact ${fact.id} has no year`);
      raw = String(fact.year);
    } else {
      raw = objectValue(world, fact);
    }
    return applyTransform(raw, slot.transform);
  });
}

/**
 * What the router accepts for each slot: the password part, and for a "first word" part the whole name too.
 * Typing "Niagara Falls" or "Marge Novak" shows the player worked it out; the router keeps the first word
 * (review 44, F1). The password itself (slotParts) doesn't change.
 */
export function slotAnswers(world: GrandmaWorld, recipe: Recipe): string[][] {
  const parts = slotParts(world, recipe);
  return recipe.slots.map((slot, i) => {
    const fact = factById(world, slot.fact_id)!;
    if (slot.field !== "object" || slot.transform !== "first_word") return [parts[i]!];
    const whole = objectValue(world, fact);
    return whole === parts[i] ? [parts[i]!] : [parts[i]!, whole];
  });
}

/** Every fact on this recipe's inference chains: slot facts, separate groups, anchor facts. */
export function chainFacts(world: GrandmaWorld, recipe: Recipe): Set<string> {
  const ids = new Set<string>(recipe.slots.map((s) => s.fact_id));
  for (const g of recipe.separate ?? []) for (const id of g) ids.add(id);
  for (const slot of recipe.slots) {
    const anchor = slot.requires_anchor ? world.anchors?.find((a) => a.id === slot.requires_anchor) : undefined;
    for (const id of anchor?.via_fact_ids ?? []) ids.add(id);
  }
  return ids;
}

/** Does `text` contain every slot value of the recipe as a whole word? (Then one memory hands over the answer.) */
export function containsAllSlots(world: GrandmaWorld, recipe: Recipe, text: string): boolean {
  const parts = slotParts(world, recipe);
  const lower = text.toLowerCase();
  return parts.length > 1 && parts.every((p) => new RegExp(`\\b${p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower));
}

/**
 * Facts that move the player forward on this recipe: the chain facts, plus any fact about the answer itself
 * when a part of the answer is a person, pet or place. "Biscuit stole every sock" is about the answer to Easy's
 * first part, so asking who stole the socks is progress, not stalling (review, iteration 41).
 */
export function progressFacts(world: GrandmaWorld, recipe: Recipe): Set<string> {
  const ids = chainFacts(world, recipe);
  const answers = new Set<string>();
  for (const slot of recipe.slots) {
    const fact = factById(world, slot.fact_id);
    if (slot.field !== "year" && typeof fact?.object === "string" && entityById(world, fact.object)) answers.add(fact.object);
  }
  for (const f of world.facts) if (answers.has(f.subject) || (typeof f.object === "string" && answers.has(f.object))) ids.add(f.id);
  return ids;
}

/** Answers Grandma doesn't remember on this note (Slot.hidden): only the room shows them. */
export function hiddenAnswers(world: GrandmaWorld, recipe: Recipe): string[] {
  if (!recipe.slots.some((s) => s.hidden)) return [];
  const parts = slotParts(world, recipe);
  return recipe.slots.flatMap((s, i) => (s.hidden ? [parts[i]!] : []));
}

/** Whole-word, case-blind "does `text` say `value`". */
export function saysValue(text: string, value: string): boolean {
  const v = value.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${v}([^a-z0-9]|$)`, "i").test(text);
}

/**
 * The world as Grandma remembers it on this note: without the memories and stories that say an answer she doesn't
 * remember (Slot.hidden). Her brain (model or offline) and her topic cards use this; the checks use the whole world.
 */
export function forgetful(world: GrandmaWorld, recipe: Recipe): GrandmaWorld {
  const hidden = hiddenAnswers(world, recipe);
  if (!hidden.length) return world;
  const ids = new Set(recipe.slots.filter((s) => s.hidden).map((s) => s.fact_id));
  const says = (t: string) => hidden.some((a) => saysValue(t, a));
  // The line's pointer memory ("the sign in the hall is no better… a photo of the porch in the album") is what she
  // says when asked about it in any words, not only through its card: it sends the player to the room.
  const pointers = new Set(recipe.slots.flatMap((s, i) => (s.hidden ? (recipe.note_facts?.[i] ?? []) : [])));
  const unpoint = (f: Fact): Fact => (pointers.has(f.id) && f.tags?.includes("pointer") ? { ...f, tags: f.tags.filter((t) => t !== "pointer") } : f);
  return {
    ...world,
    facts: world.facts.filter((f) => !ids.has(f.id) && !says(f.text)).map(unpoint),
    stories: world.stories?.filter((s) => !says(s.text)),
  };
}

/**
 * Years the model must not see for this recipe: the year behind any anchor the recipe requires.
 * In hard mode the player has to work the year out from the anchor phrase.
 */
export function hiddenYears(world: GrandmaWorld, recipe: Recipe): Set<number> {
  const years = new Set<number>();
  for (const slot of recipe.slots) {
    if (!slot.requires_anchor) continue;
    const anchor = world.anchors?.find((a) => a.id === slot.requires_anchor);
    if (anchor) years.add(anchor.resolves_to_year);
  }
  return years;
}

/**
 * Words that tie a "little thing" to the puzzles or to time, so it can't be colour (iteration 64): when things
 * happened, the note's subjects (streets, house numbers, birds, the falls, the snowstorm, the color TV), and where
 * things are kept in the house (a player would go looking for them).
 */
const COLOUR_FORBIDDEN =
  /\b(year|years|summer|winter|spring|autumn|fall|when (we|i|he|she|you)|since|before|after|ago|age|old enough|born|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|street|avenue|apartment|house number|mailbox|door number|bird|birds|sparrow|chirp\w*|falls|honeymoon|snowstorm|blizzard|moon|color tv|drawer|closet|attic|basement|cupboard|shelf|album|hide|hides|hid|hidden|hiding|tuck\w*|stash\w*|behind the|under the|password|wi-?fi|router)\b/i;

/** Problems with the world's little things: they must stay colour and never become clues or answers. */
export function checkColour(world: GrandmaWorld): string[] {
  const problems: string[] = [];
  const entityIds = new Set(world.entities.map((e) => e.id));
  // Names she already knows (capitalised words anywhere in her world); a little thing may not add one.
  const known = new Set<string>(["I", "Christmas", "Eve", "Easter", "Sunday", "Sundays", "Saturday", "Tuesday", "Tuesdays", "Grandma", "Grandpa", "Uncle", "Aunt"]);
  const texts = [world.profile.name, world.profile.hometown, ...world.entities.flatMap((e) => [e.name, ...(e.aliases ?? [])]), ...world.facts.map((f) => f.text), ...(world.stories ?? []).map((s) => s.text)];
  for (const t of texts) for (const w of t.match(/[A-Z][a-zA-Z-]+/g) ?? []) known.add(w);
  // Every word of every answer, from every recipe.
  const answers = new Set<string>();
  for (const r of world.recipes) {
    try {
      for (const part of slotAnswers(world, r)) for (const a of part) answers.add(String(a).toLowerCase());
    } catch {
      /* reported elsewhere */
    }
  }
  const seen = new Set<string>();
  for (const c of world.colour ?? []) {
    if (seen.has(c.id)) problems.push(`duplicate colour id ${c.id}`);
    seen.add(c.id);
    for (const id of c.about) if (!entityIds.has(id)) problems.push(`colour ${c.id}: unknown entity ${id}`);
    if (/\d/.test(c.text)) problems.push(`colour ${c.id}: has a digit (numbers and years are facts, not colour)`);
    const bad = COLOUR_FORBIDDEN.exec(c.text);
    if (bad) problems.push(`colour ${c.id}: "${bad[0]}" ties it to time, a puzzle or a place in the house`);
    const words: string[] = c.text.toLowerCase().match(/[a-z]+/g) ?? [];
    for (const a of answers) if (/^[a-z]+$/.test(a) && words.includes(a)) problems.push(`colour ${c.id}: says "${a}", a part of a password`);
    for (const sentence of c.text.split(/(?<=[.!?])\s+/)) {
      for (const w of (sentence.match(/[A-Za-z][a-zA-Z'-]*/g) ?? []).slice(1)) {
        const bare = w.replace(/'s$/, "").replace(/'+$/, "");
        if (/^[A-Z]/.test(bare) && !/^I'/.test(bare) && !known.has(bare)) problems.push(`colour ${c.id}: "${bare}" is a name she doesn't otherwise know`);
      }
    }
  }
  return problems;
}

/** Cross-reference checks the JSON Schema can't express. Returns a list of problems (empty = valid). */
export function checkWorld(world: GrandmaWorld): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const dup = (kind: string, id: string) => {
    if (ids.has(id)) problems.push(`duplicate id ${id} (${kind})`);
    ids.add(id);
  };
  world.entities.forEach((e) => dup("entity", e.id));
  world.facts.forEach((f) => dup("fact", f.id));
  world.anchors?.forEach((a) => dup("anchor", a.id));
  world.stories?.forEach((s) => dup("story", s.id));
  world.recipes.forEach((r) => dup("recipe", r.id));

  const entityIds = new Set(world.entities.map((e) => e.id));
  const factIds = new Set(world.facts.map((f) => f.id));
  for (const f of world.facts) {
    if (!entityIds.has(f.subject)) problems.push(`fact ${f.id}: unknown subject ${f.subject}`);
    for (const c of f.confusable_with ?? []) {
      if (!factIds.has(c)) problems.push(`fact ${f.id}: unknown confusable ${c}`);
    }
  }
  // Years must be plausible: not before Grandma was born, not in the future.
  const thisYear = new Date().getFullYear();
  for (const f of world.facts) {
    if (f.year === undefined) continue;
    if (f.year < world.profile.birth_year || f.year > thisYear) problems.push(`fact ${f.id}: year ${f.year} is outside ${world.profile.birth_year}–${thisYear}`);
  }
  // Self-corrections: a nearby wrong year on a fact that has a year, never a year she must hide.
  for (const f of world.facts) {
    if (f.misremembers === undefined) continue;
    if (f.year === undefined) problems.push(`fact ${f.id}: misremembers ${f.misremembers} but has no year`);
    else if (f.misremembers === f.year || Math.abs(f.misremembers - f.year) > 3) problems.push(`fact ${f.id}: misremembers ${f.misremembers} should be within 3 years of ${f.year} and different`);
    for (const r of world.recipes) {
      if (f.year !== undefined && hiddenYears(world, r).has(f.year)) problems.push(`fact ${f.id}: its year is hidden in ${r.id}, so it can't have a self-correction`);
    }
  }
  for (const a of world.anchors ?? []) {
    for (const id of a.via_fact_ids ?? []) {
      if (!factIds.has(id)) problems.push(`anchor ${a.id}: unknown fact ${id}`);
    }
  }
  for (const s of world.stories ?? []) {
    for (const id of s.fact_ids) if (!factIds.has(id)) problems.push(`story ${s.id}: unknown fact ${id}`);
  }
  problems.push(...checkColour(world));
  for (const r of world.recipes) {
    try {
      const computed = computePassword(world, r);
      if (computed !== r.password) problems.push(`recipe ${r.id}: password ${r.password} != computed ${computed}`);
    } catch (e) {
      problems.push((e as Error).message);
    }
    for (const slot of r.slots) {
      if (slot.requires_anchor && !world.anchors?.some((a) => a.id === slot.requires_anchor)) {
        problems.push(`recipe ${r.id}: unknown anchor ${slot.requires_anchor}`);
      }
    }
  }
  const topicIds = new Set((world.topics ?? []).map((t) => t.id));
  for (const t of world.topics ?? []) {
    for (const id of t.facts) if (!factIds.has(id)) problems.push(`topic ${t.id}: unknown fact ${id}`);
  }
  if ((world.topics ?? []).length !== topicIds.size) problems.push("duplicate topic id");
  for (const id of world.start_topics ?? []) if (!topicIds.has(id)) problems.push(`start_topics: unknown topic ${id}`);
  for (const r of world.recipes) {
    const parts = r.note_text.split("+").length;
    if (r.note_facts && r.note_facts.length > parts) problems.push(`recipe ${r.id}: note_facts has ${r.note_facts.length} parts, the note ${parts}`);
    for (const id of (r.note_facts ?? []).flat()) if (!factIds.has(id)) problems.push(`recipe ${r.id}: note_facts has unknown fact ${id}`);
  }
  for (const r of world.recipes) {
    for (const group of r.separate ?? []) {
      for (const id of group) {
        if (!world.facts.some((f) => f.id === id)) problems.push(`recipe ${r.id}: separate group has unknown fact ${id}`);
      }
    }
    // An anchor must resolve to the year of the slot fact that uses it.
    for (const slot of r.slots) {
      if (!slot.requires_anchor) continue;
      const anchor = world.anchors?.find((a) => a.id === slot.requires_anchor);
      const fact = world.facts.find((f) => f.id === slot.fact_id);
      if (anchor && fact?.year !== undefined && anchor.resolves_to_year !== fact.year) {
        problems.push(`recipe ${r.id}: anchor ${anchor.id} resolves to ${anchor.resolves_to_year} but ${fact.id} is ${fact.year}`);
      }
    }
    // No single memory may contain the whole answer: Grandma would hand it over in one reply.
    try {
      for (const f of world.facts) {
        if (containsAllSlots(world, r, f.text)) problems.push(`recipe ${r.id}: fact ${f.id} alone contains every slot value`);
      }
      for (const s of world.stories ?? []) {
        if (containsAllSlots(world, r, s.text)) problems.push(`recipe ${r.id}: story ${s.id} alone contains every slot value`);
      }
    } catch {
      /* unknown slot facts are reported above */
    }
  }
  return problems;
}
