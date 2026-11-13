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
