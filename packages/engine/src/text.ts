/** Small text helpers shared by the rules, the validator and the mock Grandma. */
import type { Fact, GrandmaWorld } from "./world.ts";
import { entityById } from "./world.ts";

const STOPWORDS = new Set(
  (
    "a an the and or but if of to in on at by for with from up about into over after before " +
    "is are was were be been being am do does did done have has had having " +
    "i me my mine you your yours he him his she her hers it its we us our they them their " +
    "what which who whom whose when where why how this that these those there here " +
    "can could would should will shall may might must not no yes so very just really " +
    "tell say said know remember think ever any some all one grandma granny nana please oh well"
  ).split(" "),
);

/** Very light stemming: enough for "dogs" ~ "dog", "married" ~ "marri". */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

/** Synonyms map a player's word onto the words facts tend to use. Keys and values are stems. */
const SYNONYMS: Record<string, string[]> = {
  dog: ["pet", "puppy", "beagle", "spaniel"],
  puppy: ["dog", "pet"],
  pet: ["dog", "cat"],
  cat: ["pet"],
  marri: ["wedd", "wedding"],
  marry: ["wedd", "wedding"],
  wedd: ["marri"],
  meet: ["met"],
  met: ["meet"],
  husband: ["grandpa", "walt"],
  grandpa: ["walt", "husband"],
  grandfather: ["grandpa", "walt"],
  mom: ["linda", "mother"],
  mother: ["mom"],
  uncle: ["michael", "stan"],
  street: ["home", "apartment", "avenue", "house"],
  live: ["home", "apartment", "house", "street"],
  liv: ["home", "apartment", "house", "street"],
  house: ["home", "street", "avenue"],
  address: ["number", "street", "avenue"],
  number: ["address"],
  job: ["work", "operator", "cook"],
  work: ["job"],
  nickname: ["call"],
  call: ["nickname"],
  bird: ["sparrow", "nickname"],
  name: ["call"],
  knot: ["marri", "wedding"],
  sock: ["biscuit"],
  thief: ["stole"],
  tv: ["television", "color"],
  television: ["tv"],
  crooked: ["number", "mailbox"],
  snow: ["snowstorm", "winter", "sledd"],
  winter: ["snow", "snowstorm"],
};

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? [])
    .map((w) => w.replace(/'s$/, "").replace(/'/g, ""))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

export function expandedTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of tokens(text)) {
    out.add(t);
    for (const s of SYNONYMS[t] ?? []) out.add(stem(s));
  }
  return out;
}

/** Keywords that describe a fact: its text, predicate, tags and the names of its entities. */
export function factKeywords(world: GrandmaWorld, fact: Fact): Set<string> {
  const parts: string[] = [fact.text, fact.predicate.replace(/_/g, " "), ...(fact.tags ?? [])];
  for (const id of [fact.subject, typeof fact.object === "string" ? fact.object : ""]) {
    const e = id ? entityById(world, id) : undefined;
    if (e) parts.push(e.name, ...(e.aliases ?? []), e.relation_to_player ?? "");
  }
  return new Set(tokens(parts.join(" ")));
}

export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Deterministic PRNG (mulberry32) so mock replies and tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function pick<T>(items: readonly T[], rand: () => number): T {
  if (items.length === 0) throw new Error("pick from empty list");
  return items[Math.floor(rand() * items.length)] as T;
}

/** True if the text still has a "WRONG… no, RIGHT" year correction in it. */
export function hasSelfCorrection(text: string): boolean {
  return /\b(1[89]\d\d|20\d\d)\s*(?:…|\.\.\.|,|—|-)?\s*(?:no|wait|oh no)[,!.]?\s*(?:it was\s+)?(?:'\d\d|1[89]\d\d|20\d\d)\b/i.test(text);
}

/**
 * Self-corrections (game design §3.2): "It was 1962… no, '61." Replaces each "WRONG… no, RIGHT" with just
 * RIGHT, so year checks and the notebook see the year she settled on. With `allowed` (wrong → right),
 * only those exact pairs count; anything else is left alone (and then fails the usual checks).
 */
export function resolveSelfCorrections(text: string, allowed?: ReadonlyMap<number, number>): string {
  const re = /\b(1[89]\d\d|20\d\d)\s*(?:…|\.\.\.|,|—|-)?\s*(?:no|wait|oh no)[,!.]?\s*(?:it was\s+)?(?:'(\d\d)|(1[89]\d\d|20\d\d))\b/gi;
  return text.replace(re, (whole, wrongS: string, short?: string, full?: string) => {
    const wrong = Number(wrongS);
    const right = full ? Number(full) : Math.floor(wrong / 100) * 100 + Number(short);
    if (right === wrong) return whole;
    if (allowed && allowed.get(wrong) !== right) return whole;
    return String(right);
  });
}

/**
 * The text as plain characters: fullwidth and other compatibility forms folded to ASCII ("Ｂｉｓ１９" → "Bis19")
 * and invisible format characters (zero-width spaces and joiners) removed. Every check reads this form, so
 * look-alike characters can't carry a password past them (security review, iteration 34).
 */
export function plainText(text: string): string {
  return text.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

/** Letters outside the Latin script and digits other than 0–9 (after `plainText`): look-alikes the checks can't read. */
export function foreignChars(text: string): string[] {
  return [...new Set(text.match(/[\p{L}\p{N}]/gu)?.filter((c) => !/[0-9]|\p{Script=Latin}/u.test(c)) ?? [])];
}

/** Single digits said one at a time ("1 9 6 1", "4-1-2") joined into one number. */
export function spacedDigitRuns(text: string): string[] {
  return [...text.matchAll(/\b\d(?:[\s.,\-–]+\d\b){2,}/g)].map((m) => m[0].replace(/\D/g, ""));
}

const DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** "sixty-one" → 61, "twelve" → 12, "seven" → 7; undefined if it isn't a number under 100. */
function wordsUnder100(s: string): number | undefined {
  const w = s.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (w.length === 1) {
    const d = DIGIT_WORDS.indexOf(w[0]!);
    if (d >= 0) return d;
    const t = TEENS.indexOf(w[0]!);
    if (t >= 0) return 10 + t;
    const tens = TENS.indexOf(w[0]!);
    return tens >= 2 ? tens * 10 : undefined;
  }
  if (w.length === 2) {
    const tens = TENS.indexOf(w[0]!);
    const d = DIGIT_WORDS.indexOf(w[1]!);
    if (tens >= 2 && d >= 1) return tens * 10 + d;
  }
  return undefined;
}

const UNDER_100 = String.raw`(?:(?:${TENS.slice(2).join("|")})(?:[\s-]+(?:${DIGIT_WORDS.slice(1).join("|")}))?|${TEENS.join("|")}|${DIGIT_WORDS.join("|")})`;

/**
 * Other ways a reply can spell out an answer part, for the leak check (technical design §5⑥d):
 * short years ('61 → 1961 and 2061), spelled years ("nineteen sixty-one" → 1961), runs of digit words
 * ("four one two" → 412), digits one at a time ("1 9 6 1" → 1961) and letter-by-letter words ("B-i-s-c-u-i-t" → Biscuit). Returns the text with
 * those forms added, so a check that looks for the plain forms also catches them.
 */
export function leakForms(text: string): string {
  const extra: string[] = [];
  for (const m of text.matchAll(/['’‘](\d\d)\b/g)) extra.push(`19${m[1]}`, `20${m[1]}`);
  const year = new RegExp(String.raw`\b(nineteen|twenty)[\s-]+(?:hundred[\s-]+(?:and[\s-]+)?)?(${UNDER_100})\b`, "gi");
  for (const m of text.matchAll(year)) {
    const n = wordsUnder100(m[2]!);
    if (n !== undefined) extra.push(String((m[1]!.toLowerCase() === "nineteen" ? 1900 : 2000) + n));
  }
  const digits = new RegExp(String.raw`\b(?:${DIGIT_WORDS.join("|")})(?:[\s,-]+(?:${DIGIT_WORDS.join("|")}))+\b`, "gi");
  for (const m of text.matchAll(digits)) extra.push(m[0].toLowerCase().split(/[\s,-]+/).map((w) => DIGIT_WORDS.indexOf(w)).join(""));
  for (const m of text.matchAll(/\b[A-Za-z](?:[\s.\-–]+[A-Za-z]\b){2,}/g)) extra.push(m[0].replace(/[^A-Za-z]/g, ""));
  extra.push(...spacedDigitRuns(text));
  return extra.length ? `${text} ${extra.join(" ")}` : text;
}
