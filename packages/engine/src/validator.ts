/**
 * Reply validator (technical design §5, step ⑥). Rule-based and cheap; it runs on every reply
 * from both the LLM Grandma and the mock Grandma.
 */
import type { GrandmaWorld, Recipe } from "./world.ts";
import { containsAllSlots, factById, hiddenYears, objectValue } from "./world.ts";
import { factKeywords, foreignChars, hasSelfCorrection, leakForms, normalizeForMatch, plainText, resolveSelfCorrections, spacedDigitRuns, tokens } from "./text.ts";

export interface GrandmaOutput {
  reply: string;
  fact_ids_used: string[];
  distractor_ids: string[];
  mood: "happy" | "nostalgic" | "teasing" | "confused" | "sleepy" | "suspicious" | "worried";
}

export interface ValidationContext {
  password: string;
  /** Years Grandma may only refer to by anchor phrase (hard mode). */
  hiddenYears: Set<number>;
  currentYear: number;
  /** From the recipe: at most one fact of each group per reply (see Recipe.separate). */
  separate?: readonly (readonly string[])[];
  /** The recipe itself, for the "every part of the password" leak check. */
  recipe?: Recipe;
}

/**
 * Cheap contradiction check: a cited fact with a year whose name appears in the same sentence as a
 * different year that no other cited fact explains. (The eval's LLM judge does the thorough job.)
 */
export function contradictions(world: GrandmaWorld, t: { reply: string; factIds: readonly string[] }): string[] {
  const cited = t.factIds.map((id) => factById(world, id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const citedYears = new Set(cited.map((f) => f.year).filter((y): y is number => typeof y === "number"));
  const out: string[] = [];
  for (const sentence of t.reply.split(/(?<=[.!?])\s+/)) {
    const years = (sentence.match(/\b(1[89]\d\d|20\d\d)\b/g) ?? []).map(Number);
    if (!years.length) continue;
    for (const f of cited) {
      if (typeof f.year !== "number") continue;
      const name = objectValue(world, f).toLowerCase();
      if (!name || !sentence.toLowerCase().includes(name)) continue;
      for (const y of years) if (y !== f.year && !citedYears.has(y)) out.push(`${f.id}: says ${y}, the memory says ${f.year}`);
    }
  }
  return out;
}

/** The validation context for a run of this recipe. */
export function validationContext(world: GrandmaWorld, recipe: Recipe, currentYear = new Date().getFullYear()): ValidationContext {
  return { password: recipe.password, hiddenYears: hiddenYears(world, recipe), currentYear, separate: recipe.separate ?? [], recipe };
}

/** Everyday words that say nothing about which memory a sentence is about (stems, as `tokens` makes them). */
const GENERIC_WORDS = new Set(["came", "along", "home", "year", "first", "little", "still", "since", "every", "time", "back", "went", "made", "took", "told", "brought", "never", "always", "once", "ever"]);

/**
 * Which of these facts a reply tells, read from its text: a sentence with the fact's year (or its number, for a
 * fact that is a number) and one of the fact's own words. "In 1964 we bought the house on Maple" tells f_house.
 */
export function factsToldIn(world: GrandmaWorld, reply: string, ids: readonly string[]): string[] {
  const sentences = reply
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => ({ nums: new Set((s.match(/\d+/g) ?? []).map(Number)), words: new Set(tokens(s)) }));
  return ids.filter((id) => {
    const fact = factById(world, id);
    if (!fact) return false;
    const n = fact.object;
    if (typeof n === "number") return sentences.some((s) => s.nums.has(n));
    const year = fact.year;
    if (year === undefined) return false;
    // Only telling words count: "We got married in 1961" doesn't tell the 1961 honeymoon ("Walt got soaked").
    const keys = [...factKeywords(world, fact)].filter((k) => !/^\d+$/.test(k) && k.length >= 4 && !GENERIC_WORDS.has(k));
    return sentences.some((s) => s.nums.has(year) && keys.some((k) => s.words.has(k)));
  });
}

/** Facts from one separate-group that a reply used together. */
export function joinedFacts(used: readonly string[], separate: readonly (readonly string[])[] = []): string[][] {
  return separate.map((g) => g.filter((id) => used.includes(id))).filter((hit) => hit.length > 1);
}

const ALWAYS_OK_WORDS = new Set(
  (
    "I I'm I'd I'll I've Grandma Grandpa Granny Nana Sweetheart Sweetie Honey Dear Mom Dad Mother Father " +
    "God Lord Heavens Christmas Eve Easter Thanksgiving Sunday Monday Tuesday Wednesday Thursday Friday Saturday " +
    "January February March April May June July August September October November December " +
    "Wi-Fi WiFi Internet TV OK Oh Mr Mrs Miss"
  ).split(" "),
);

const MAX_REPLY_CHARS = 700;

/** Every number and capitalized word that appears anywhere in the world's own text. */
export function worldVocabulary(world: GrandmaWorld): { numbers: Set<number>; names: Set<string> } {
  const numbers = new Set<number>();
  const names = new Set<string>();
  const texts: string[] = [
    world.profile.name,
    world.profile.nickname ?? "",
    world.profile.hometown,
    ...world.profile.verbal_tics,
    ...world.entities.flatMap((e) => [e.name, ...(e.aliases ?? [])]),
    ...world.facts.map((f) => f.text),
    ...(world.anchors ?? []).map((a) => a.phrase),
    ...(world.stories ?? []).map((s) => s.text),
  ];
  for (const f of world.facts) {
    if (f.year !== undefined) numbers.add(f.year);
    if (typeof f.object === "number") numbers.add(f.object);
  }
  numbers.add(world.profile.birth_year);
  for (const t of texts) {
    for (const n of t.match(/\d+/g) ?? []) numbers.add(Number(n));
    for (const w of t.match(/[A-Z][a-zA-Z'-]+/g) ?? []) names.add(w.replace(/'s$/, ""));
  }
  return { numbers, names };
}

/** "nineteen seventy-seven" and friends. */
const SPELLED_YEAR = /\bnineteen[- ](twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/i;

export function validateReply(world: GrandmaWorld, out: GrandmaOutput, ctx: ValidationContext): string[] {
  const errors: string[] = [];
  const factIds = new Set(world.facts.map((f) => f.id));
  for (const id of [...out.fact_ids_used, ...out.distractor_ids]) {
    if (!factIds.has(id)) errors.push(`unknown fact id "${id}"`);
  }
  // Allowed self-corrections ("1962… no, 1961") count as the year she settled on.
  const corrections = new Map(world.facts.filter((f) => f.misremembers !== undefined && f.year !== undefined).map((f) => [f.misremembers!, f.year!] as const));
  // Checks read the plain form: fullwidth "１９６１" is 1961, zero-width characters are gone (security review, iteration 34).
  const reply = resolveSelfCorrections(plainText(out.reply).trim(), corrections);
  if (!reply) errors.push("empty reply");
  const foreign = foreignChars(reply);
  if (foreign.length) errors.push(`characters outside plain English (${foreign.slice(0, 5).join(" ")}); write in plain English letters and digits`);
  if (reply.length > MAX_REPLY_CHARS) errors.push(`reply too long (${reply.length} chars, max ${MAX_REPLY_CHARS})`);
  if (hasSelfCorrection(reply)) errors.push("self-correction on a memory that isn't marked for one (or to the wrong year); say the year once");

  // Numbers must come from the world (plus small counts and Grandma's age). A short year ("'61") counts
  // as the full year when that year is one of her memories.
  const vocab = worldVocabulary(world);
  const age = ctx.currentYear - world.profile.birth_year;
  const shortYear = (yy: string) => [1900, 2000].map((c) => c + Number(yy)).find((y) => vocab.numbers.has(y));
  const forNumbers = reply.replace(/(^|[^\w])'(\d\d)\b/g, (m, pre: string, yy: string) => {
    const full = shortYear(yy);
    return full ? `${pre}${full}` : m;
  });
  for (const raw of [...(forNumbers.match(/\d+/g) ?? []), ...spacedDigitRuns(forNumbers)]) {
    const n = Number(raw);
    if (ctx.hiddenYears.has(n)) {
      errors.push(`said the year ${n}, which must only be given as its anchor phrase`);
    } else if (n > 12 && !vocab.numbers.has(n) && Math.abs(n - age) > 1) {
      errors.push(`number ${n} is not in Grandma's facts`);
    }
  }
  if (ctx.hiddenYears.size > 0 && SPELLED_YEAR.test(reply)) {
    // Spelled-out years could dodge the digit check in hard mode.
    errors.push("spelled-out year in hard mode; give years in digits, or by anchor phrase when hidden");
  }

  // Capitalized words that aren't sentence-initial must be known names.
  const sentences = reply.split(/(?<=[.!?…])\s+|\n+/);
  const unknown = new Set<string>();
  for (const sentence of sentences) {
    const words = sentence.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
    words.slice(1).forEach((w) => {
      const bare = w.replace(/'s$/, "");
      if (!/^[A-Z]/.test(bare)) return;
      if (ALWAYS_OK_WORDS.has(bare) || vocab.names.has(bare)) return;
      unknown.add(bare);
    });
  }
  if (unknown.size) errors.push(`names not in Grandma's world: ${[...unknown].join(", ")}`);

  // One link of an inference chain per reply.
  // The model's own list of memories, plus any it told without listing them (citing nothing doesn't skip the rule).
  const told = [...new Set([...out.fact_ids_used, ...factsToldIn(world, reply, (ctx.separate ?? []).flat())])];
  for (const hit of joinedFacts(told, ctx.separate)) {
    errors.push(`used ${hit.join(" and ")} together; tell just one of these memories per reply and let the grandchild ask a follow-up`);
  }

  // Contradiction: a cited memory said with the wrong year in the same sentence.
  for (const c of contradictions(world, { reply, factIds: out.fact_ids_used })) errors.push(`contradicts a memory: ${c}`);

  // Leak checks: the password forwards or backwards (ignoring case, spaces and punctuation), or every part of it,
  // also when parts are said another way ('61, "nineteen sixty-one", "four one two", "B-i-s-c-u-i-t").
  const pw = normalizeForMatch(ctx.password);
  const forms = leakForms(reply);
  const said = normalizeForMatch(reply); // already ignores spaces and dashes: "B-i-s-c-u-i-t 1961" is caught here
  if (pw.length >= 4 && (said.includes(pw) || said.includes([...pw].reverse().join("")))) errors.push("reply contains the password");
  else if (ctx.recipe && containsAllSlots(world, ctx.recipe, forms)) errors.push("reply contains every part of the password; give one memory at a time");

  return errors;
}
