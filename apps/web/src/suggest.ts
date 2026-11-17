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
const DETERMINERS = /^(the|a|an|my|our|your|his|her|their|that|this|where|when|who|what|how)\b/i;

/** The note is in Grandma's voice; the player asks in their own. One pass, so "your" → "my" isn't swapped back. */
const SWAP: Record<string, string> = { i: "you", me: "you", my: "your", mine: "yours", we: "you", us: "you", our: "your", ours: "yours", your: "my", yours: "mine" };
/** A quoted phrase she said ("'I do'") stays as she said it. */
const QUOTED = /((?:^|\s)(['"‘“])[^'"‘’“”]+['"’”](?=$|[\s.,!?]))/;

/**
 * "my favorite dog" → "your favorite dog", "where we spent our honeymoon" → "where you spent your honeymoon",
 * "the year your mom was born" → "the year my mom was born", "the year we said 'I do'" keeps 'I do'.
 */
export function toAsker(part: string): string {
  return part
    .split(QUOTED)
    .map((piece, i) => {
      if (i % 3 === 1) return piece; // the quoted phrase
      if (i % 3 === 2) return ""; // the captured quote mark, already inside the phrase
      return piece.replace(/\b(i|me|my|mine|we|us|our|ours|your|yours)\b/gi, (w) => {
        const to = SWAP[w.toLowerCase()]!;
        return w[0] === w[0]!.toUpperCase() && w.toLowerCase() !== "i" ? to[0]!.toUpperCase() + to.slice(1) : to;
      });
    })
    .join("");
}

/**
 * One part of the note as something to ask about: no smudges, not too long ("the street we lived on the
 * year we got the col█r TV" becomes "the street you lived on"), in the player's voice (see toAsker), and
 * with an article ("year of the big snowstorm" becomes "the year of the big snowstorm"). Undefined when
 * there's nothing to ask (a bare "!").
 */
export function askablePart(part: string): string | undefined {
  let p = part.trim();
  const cut = p.search(/\s(the year|when|that|which)\s/i);
  const smudge = p.indexOf("█");
  if (smudge >= 0) {
    // Only offer a smudged part if it reads as a whole idea before the smudge ("the street we lived on").
    // "the number Grandpa ███" is what the reading glasses are for, not a chip.
    if (cut <= 0 || cut > smudge) return undefined;
    p = p.slice(0, cut);
  } else if (p.split(/\s+/).filter(Boolean).length > 7 && cut > 0) {
    p = p.slice(0, cut);
  }
  p = toAsker(p.trim().replace(/[.,;:]+$/, ""));
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
