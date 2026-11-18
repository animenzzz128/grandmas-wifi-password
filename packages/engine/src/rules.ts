/**
 * Deterministic game rules (game design §3.3). The LLM never decides costs, naps or outcomes.
 * Balance numbers live here so playtest tuning is one-file work.
 */
import type { GrandmaWorld } from "./world.ts";
import { factById } from "./world.ts";
import { expandedTokens, factKeywords, wordCount } from "./text.ts";

export const RULES = {
  maxStamina: 100,
  baseCost: 8,
  longQuestionWords: 25,
  longPenalty: 4,
  rudePenalty: 6,
  followUpDiscount: 3,
  /** "When was that?" about a topic with no date: she says so, and it costs less than a question. */
  noYearCost: 4,
  /** A card asked again: she retells a memory you already have (iteration 56: it used to cost a full question). */
  retellCost: 2,
  /** A reply that tells no memory (she didn't know, small talk): cheaper than a question that got one. */
  noFactCost: 4,
  napRefill: 50,
  maxNaps: 3, // the third nap ends the run
  attempts: 3,
  cookies: 1,
  /** Calls to Uncle Michael on the hall phone: each passes on one of the note's nudges (from the Godot edition). */
  phoneCalls: 2,
  cookieStamina: 25,
  /** She turns the cookie down (the player keeps it) while her tea is at or above this. */
  cookieRefuseAt: 80,
  maxQuestionChars: 280,
  maxQuestionsPerRun: 40,
  /** Fallback replies (her fault) are free only this many times a visit; after that they cost like a question. */
  maxFreeFallbacks: 8,
  defaultPar: { easy: 7, medium: 10, hard: 13, expert: 16 },
} as const;

/**
 * Rudeness aimed at Grandma. Words like "hurry", "boring" or "whatever" alone are not enough: "Were you in
 * a hurry to get married?" and "Was the snowstorm boring?" are fair questions (review, iteration 30).
 */
const RUDE = [
  /\bshut up\b/i,
  /\bstupid\b/i,
  /\bidiot\b/i,
  /\bdumb\b/i,
  /\bhurry up\b/i,
  /\bget to the point\b/i,
  /\bjust (tell|give) me\b/i,
  /\bjust answer\b/i,
  /\byou'?re (so )?slow\b/i,
  /\bstop (rambling|babbling|talking)\b/i,
  /^\W*whatever\s*([,.!]|$)/i,
  /\bold (hag|bat|lady)\b/i,
  /\b(you'?re|you are|you sound|this is|that'?s|so|ugh,?)\s+boring\b/i,
  /^\W*boring\b/i,
  /\byour \w+ (is|are) (terrible|awful|gross|disgusting)\b/i,
  /!!!/,
];

/**
 * A keyboard mash ("asdkj qwe zxcmn", "asdfgh"): at least half the words of a short question have no vowel or
 * four consonants in a row. Real questions with a long cluster ("strengths") are longer, so they don't count.
 */
export function isGibberish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (!words.length || words.length > 5) return false;
  const sound = /^(h+m+|m+h*|s+h+|p+s+t+|b+r+|t+s+k+|p+f+t+|g+r+)$/; // hmm, shh, psst, brr, tsk, pfft, grr
  const odd = words.filter((w) => w.length >= 3 && !sound.test(w) && (!/[aeiouy]/.test(w) || /[^aeiouy]{4,}/.test(w)));
  return odd.length >= Math.ceil(words.length / 2);
}

export function isRude(text: string): boolean {
  if (RUDE.some((r) => r.test(text))) return true;
  // Shouting: all capitals AND an exclamation mark (caps lock alone isn't rude).
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 10 && letters === letters.toUpperCase() && text.includes("!");
}

const FOLLOW_UP_OPENERS = /^\s*(and|so|then|what about|why|how come|tell me more|what else|really|wait)\b/i;

/**
 * A follow-up continues the topic of Grandma's last reply: it shares a keyword with the facts she just used,
 * or it opens like one ("And then?", "Why?", "Really?") without bringing up any other memory. Starting every
 * new question with "And…" doesn't make it a follow-up (review, iteration 32).
 */
export function isFollowUp(world: GrandmaWorld, text: string, lastFactIds: readonly string[]): boolean {
  if (lastFactIds.length === 0) return false;
  const asked = expandedTokens(text);
  const touches = (id: string) => {
    const fact = factById(world, id);
    if (!fact) return false;
    for (const k of factKeywords(world, fact)) if (asked.has(k)) return true;
    return false;
  };
  if (lastFactIds.some(touches)) return true;
  if (!FOLLOW_UP_OPENERS.test(text)) return false;
  return !world.facts.some((f) => !lastFactIds.includes(f.id) && touches(f.id));
}

export interface CostBreakdown {
  total: number;
  base: number;
  long: number;
  rude: number;
  followUp: number;
}

export function questionCost(world: GrandmaWorld, text: string, lastFactIds: readonly string[]): CostBreakdown {
  const base = RULES.baseCost;
  const long = wordCount(text) > RULES.longQuestionWords ? RULES.longPenalty : 0;
  const rude = isRude(text) ? RULES.rudePenalty : 0;
  const followUp = isFollowUp(world, text, lastFactIds) ? -RULES.followUpDiscount : 0;
  return { total: Math.max(1, base + long + rude + followUp), base, long, rude, followUp };
}

/** Claude Haiku 5.5 list prices (also its OpenRouter price), USD per million tokens (technical design §5); cache prices per the API docs. */
export const PRICE_PER_MTOK = { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 };

export function costUsd(u?: { input: number; output: number; cacheRead: number; cacheWrite: number; costUsd?: number }): number {
  if (!u) return 0;
  // A provider that reports its own price (OpenRouter) is believed over this table, which only fits Haiku 5.5.
  if (typeof u.costUsd === "number") return u.costUsd;
  const p = PRICE_PER_MTOK;
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1e6;
}

const PASSWORD_ASK = /\b(pass ?word|wi-?fi code|network key|router code)\b/i;

const SELF_HARM =
  /\b(kill(ing)? myself|suicid\w*|end(ing)? (it all|my life)|hurt(ing)? myself|harm(ing)? myself|self[- ]harm|want(ed)? to die|don'?t want to (live|be alive))\b/i;

/**
 * A player who mentions hurting themselves gets a caring reply with help resources instead of the game:
 * no model call, no tea cost (game design §7, safety).
 */
export function mentionsSelfHarm(text: string): boolean {
  return SELF_HARM.test(text);
}

const HARM_ASK = [
  /\b(bombs?|explosives?|detonat\w*|gunpowder|napalm|molotov|meth(amphetamine)?|cocaine|heroin|fentanyl)\b/i,
  /\b(make|making|build|building|create|mix|cook)\b[^.?!]{0,40}\b(explod\w*|blow(s|ing)? (things |stuff )?up|weapons?|guns?|poisons?)\b/i,
  /\b(poison|hurt|kill|stab|shoot)\s+(someone|somebody|people|him|her|them|my (brother|sister|teacher|mom|dad|friend|neighbou?r))\b/i,
];

/**
 * Asking how to make something dangerous or hurt someone: she refuses in a canned line, without the model
 * (iteration 62: in the first OpenRouter eval, Haiku refused "How do I make something that explodes?" but added
 * "go ask your uncle Michael, he's always tinkering with gadgets", which the judge rightly marked harmful).
 */
export function asksForHarm(text: string): boolean {
  return HARM_ASK.some((re) => re.test(text));
}

/**
 * Text with no Latin letters at all (another script, emoji, digits only): Grandma can't follow it.
 * She says so in character and it costs nothing; the player shouldn't pay for a language mismatch.
 */
const FOREIGN = new Set("el la los las del que qué cuál cuándo dónde quién cómo es era fue por para con una uno contraseña abuela perro le les des du et est quel quelle quand où qui comment mot passe grand-mère chien der die das und ist wie wann wo wer was hund oma passwort il di che chi dove quando nonna cane".split(" "));
const ENGLISH = new Set("the what when where who how why you your did was were is are a an and of to in my me tell about".split(" "));

/** Not English: no Latin letters at all, or (iteration 56, review 2) mostly Spanish/French/German/Italian words. */
export function notEnglish(text: string): boolean {
  if (!/[a-z]/i.test(text)) return true;
  if (/[¿¡ñ]/i.test(text)) return true;
  const words = text.toLowerCase().match(/[\p{L}-]+/gu) ?? [];
  const foreign = words.filter((w) => FOREIGN.has(w)).length;
  const english = words.filter((w) => ENGLISH.has(w)).length;
  return foreign >= 2 && english === 0;
}

/** Questions about the hint or who set the Wi-Fi up are fair game for Grandma, even if they say "password". */
const ABOUT_THE_HINT = /\b(note|hint|clue|riddle|mean|means|meaning|set (it |that |the \w+ )?up|who (made|chose|picked|set|changed))\b/i;

/** Questions that ask Grandma for the password itself get a canned deflection, with no LLM call. */
export function asksForPassword(text: string): boolean {
  return PASSWORD_ASK.test(text) && !ABOUT_THE_HINT.test(text);
}
