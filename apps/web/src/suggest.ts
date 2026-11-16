/**
 * Suggested questions over the ask box (plan A2). An empty text box stops new players cold; a few chips
 * show what kinds of things Grandma can be asked. They only fill the box (the player still sends), never
 * say more than the note, an object's name or "and then?", and disappear once asked.
 */

export interface SuggestInput {
  /** The sticky note's riddle, e.g. "the sock thief + the year we said 'I do'". */
  note: string;
  /** Everything the player has asked so far (chips already asked aren't offered again). */
  asked: readonly string[];
  /** The clue object looked at most recently, if Grandma hasn't been asked about it yet. */
  lastObject?: string;
  /** Grandma has answered at least once (offer a cheap follow-up). */
  answered: boolean;
  /** Wording, from data/i18n (so the chips translate with the rest of the game). */
  words: { remember: (part: string) => string; object: (label: string) => string; followUp: string };
}

const MAX = 3;
const DETERMINERS = /^(the|a|an|my|our|your|his|her|their|that|this)\b/i;

/**
 * One part of the note as something to ask about: no smudges, not too long ("the street we lived on the
 * year we got the col█r TV" becomes "the street we lived on"), and with an article ("year of the big
 * snowstorm" becomes "the year of the big snowstorm"). Undefined when there's nothing to ask (a bare "!").
 */
export function askablePart(part: string): string | undefined {
  let p = part.trim();
  const smudge = p.indexOf("█");
  if (smudge >= 0) p = p.slice(0, smudge).replace(/\s+\S*$/, "");
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length > 7) {
    const cut = p.search(/\s(the year|when|that|which)\s/i);
    if (cut > 0) p = p.slice(0, cut);
  }
  p = p.trim().replace(/[.,;:]+$/, "");
  if (!/[a-z]{3,}/i.test(p)) return undefined;
  return DETERMINERS.test(p) ? p : `the ${p}`;
}

export function suggestions(input: SuggestInput): string[] {
  const asked = new Set(input.asked.map((q) => q.trim().toLowerCase()));
  const out: string[] = [];
  const add = (q: string) => {
    if (out.length < MAX && !asked.has(q.toLowerCase()) && !out.includes(q)) out.push(q);
  };
  if (input.lastObject) add(input.words.object(input.lastObject));
  for (const part of input.note.split("+")) {
    const p = askablePart(part);
    if (p) add(input.words.remember(p));
  }
  if (input.answered) add(input.words.followUp);
  return out;
}
