/**
 * The notebook fills itself from text the player has already seen (Grandma's replies, inspect cards).
 * It records facts, never connections: the player still does the deduction (Obra Dinn's logbook,
 * Outer Wilds' ship log). Nothing here comes from the server's fact graph, so it can't leak anything.
 */
import type { CostBreakdown } from "@gwp/engine";
import { resolveSelfCorrections } from "@gwp/engine";
import type { NoteEntry } from "./store.ts";
import { t } from "./strings.ts";

/** Capitalised words that are not names even mid-sentence. */
const NOT_NAMES = new Set(
  "I Oh Now Sweetheart Dear Honey Well Yes No Pardon Next The A An And But Our Your My We He She They It Its That This There Then When Where What Who Why How In On At Of For Every Uncle Aunt Grandpa Grandma Mom Dad Christmas Eve English Polish Wi-Fi TV St Summer Winter Spring Autumn Canadian American Italian Irish German French Page Tucked Two Inside Taped Nobody Married".split(" "),
);
const MONTHS = "January February March April May June July August September October November December".split(" ");
const DAYS = "Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(" ");
const NOT_CAPS = new Set([...MONTHS, ...DAYS].map((w) => w.toUpperCase()).concat(["APOLLO", "TV", "OK"]));
const YEAR = /^(1[89]\d\d|20[0-2]\d)$/;
const PLACE = /\b((?:[A-Z][a-z]+ )?[A-Z][a-z]+) (Street|Avenue|Road|Lane|St\.?|Ave\.?)(?=[\s,.;:!?'"]|$)/g;
const LONG_PLACE: Record<string, string> = { "St.": "Street", St: "Street", "Ave.": "Avenue", Ave: "Avenue" };

export function extractNotes(text: string, from: NoteEntry["from"]): NoteEntry[] {
  const out: NoteEntry[] = [];
  const add = (kind: NoteEntry["kind"], value: string, source: string) => {
    if (!out.some((o) => o.kind === kind && o.value === value)) out.push({ kind, value, source: source.trim(), from });
  };

  // "1962… no, '61": note the year she settled on, not the slip.
  text = resolveSelfCorrections(text);
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    // Years.
    for (const m of sentence.matchAll(/\b(1[89]\d\d|20[0-2]\d)\b/g)) add("year", m[1]!, sentence);
    // Short years on labels and in talk: 'Summer '69', 'moved out summer '64' (iteration 56).
    for (const m of sentence.matchAll(/(?:^|[\s(])['’](\d\d)\b/g)) add("year", `19${m[1]}`, sentence);

    // Places ("Maple Avenue", "Cherry Street", "Cherry St."), without a leading article.
    const placeWords = new Set<string>();
    for (const m of sentence.matchAll(PLACE)) {
      const name = m[1]!.replace(/^(The|A|An|Our|On|In) /, "");
      add("place", `${name} ${LONG_PLACE[m[2]!] ?? m[2]}`, sentence);
      name.split(" ").forEach((w) => placeWords.add(w));
    }

    // House and door numbers ("number 27", "number is 412").
    for (const m of sentence.matchAll(/\b(?:number|No\.?)(?:\s+(?:is|was))?\s+(\d{1,4})\b/g)) {
      if (!YEAR.test(m[1]!)) add("number", m[1]!, sentence);
    }

    // Names: capitalised words that aren't the first word of the sentence, a contraction, or a stop word.
    // Letters in any alphabet ("Kraków", not "Krak"); neighbouring name words stay one name ("Niagara Falls",
    // "Marge Novak"; iteration 56).
    const words = [...sentence.matchAll(/\p{L}[\p{L}'’-]*/gu)];
    const isName = (w: string, i: number) =>
      i > 0 &&
      !w.includes("'") &&
      !w.includes("’") &&
      /^\p{Lu}\p{Ll}+$/u.test(w) &&
      !NOT_NAMES.has(w) &&
      !MONTHS.includes(w) &&
      !DAYS.includes(w) &&
      !placeWords.has(w) &&
      !/^(Street|Avenue|Road|Lane)$/.test(w);
    for (let i = 0; i < words.length; i++) {
      if (!isName(words[i]![0], i)) continue;
      let name = words[i]![0];
      // Join the next word when only a space separates them and it's a name word too.
      while (i + 1 < words.length && isName(words[i + 1]![0], i + 1) && sentence.slice(words[i]!.index! + words[i]![0].length, words[i + 1]!.index!) === " ") {
        i++;
        name += ` ${words[i]![0]}`;
      }
      add("name", name, sentence);
    }
    // Quoted nicknames: 'Sparrow'.
    for (const m of sentence.matchAll(/'([A-Z][a-z]+)'/g)) add("name", m[1]!, sentence);
  }

  // On objects: painted numbers ("crooked: 412") and single words in capitals ("carved MIKEY").
  if (from === "object") {
    // Quote only the sentence a clue came from, not the whole card (iteration 56).
    const sentenceWith = (needle: string) => text.split(/(?<=[.!?])\s+/).find((s) => s.includes(needle)) ?? text;
    for (const m of text.matchAll(/:\s*(\d{1,4})\b/g)) if (!YEAR.test(m[1]!)) add("number", m[1]!, sentenceWith(m[0]));
    const tokens = text.split(/[\s,.;:·]+/).filter(Boolean);
    tokens.forEach((w, i) => {
      if (!/^[A-Z]{3,}$/.test(w) || NOT_CAPS.has(w)) return;
      const isCaps = (x?: string) => Boolean(x && /^[A-Z]{2,}$/.test(x));
      if (isCaps(tokens[i - 1]) || isCaps(tokens[i + 1])) return; // part of a caps phrase like "HIGH GAME"
      add("name", w, sentenceWith(w));
    });
  }
  return out;
}

/** "8 +6 rude" for the chat line's cost. Undefined when there's nothing beyond the base cost. */
export function costWhy(parts?: Omit<CostBreakdown, "total">): string | undefined {
  if (!parts) return undefined;
  const bits = [String(parts.base)];
  if (parts.long) bits.push(t("cost.long", { n: parts.long }));
  if (parts.rude) bits.push(t("cost.rude", { n: parts.rude }));
  if (parts.followUp) bits.push(t("cost.followUp", { n: -parts.followUp }));
  return bits.length > 1 ? bits.join(" ") : undefined;
}

/** Longest pinned quote, so a dragged-over paragraph stays a note and not a transcript. */
export const PIN_MAX = 200;

/**
 * Add a quote the player highlighted (or a whole line) to their pins: whitespace tidied, too-short or
 * duplicate quotes ignored, long ones cut at a word. Returns the same array when nothing changes.
 */
export function addPin(pins: string[], text: string): string[] {
  let quote = text.replace(/\s+/g, " ").trim();
  if (quote.length < 3) return pins;
  if (quote.length > PIN_MAX) quote = quote.slice(0, PIN_MAX).replace(/\s+\S*$/, "") + "…";
  if (pins.some((p) => p.includes(quote))) return pins;
  return [...pins.filter((p) => !quote.includes(p)), quote];
}
