/**
 * Voice mode's "hard of hearing" moment (game design §9, technical design §5 step ②): when the browser's
 * speech recognition wasn't sure what it heard, Grandma may mishear one keyword from a curated pun table
 * and answer the misheard question. It's a rule in code, not the model's choice, so it is capped and fair:
 * - only for spoken questions with a real, low confidence score (typing never mishears);
 * - at most once in every MISHEAR.gap + 1 questions;
 * - never in relaxed mode;
 * - the misheard turn costs no tea (the server waives it).
 */
import type { RunState } from "./run.ts";

export const MISHEAR = {
  /** Speech-recognition confidence below this counts as "not sure" (0 means the browser didn't say). */
  confidenceBelow: 0.8,
  /** Questions that must pass between two mishears, so at most 1 in (gap + 1). */
  gap: 4,
} as const;

/** One pun: a word (or `|`-separated spellings) the player might say, and what Grandma hears instead. */
export interface Pun {
  word: string;
  as: string;
}

export interface Mishear {
  /** The question as Grandma heard it. */
  heard: string;
  /** The words the player actually said, as written in their question. */
  said: string;
  /** What she heard instead. */
  as: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()[\]\\]/g, "\\$&");

/** Swap the first pun word found in `text` (whole words, any case). Returns undefined if none appears. */
export function applyPun(text: string, puns: readonly Pun[]): Mishear | undefined {
  for (const pun of puns) {
    const re = new RegExp(`\\b(?:${pun.word.split("|").map(escape).join("|")})\\b`, "i");
    const m = re.exec(text);
    if (!m) continue;
    return { heard: text.slice(0, m.index) + pun.as + text.slice(m.index + m[0].length), said: m[0], as: pun.as };
  }
  return undefined;
}

/**
 * Decide whether this spoken question is misheard, and keep the run's count. Call once per question.
 * `confidence` is the speech recognizer's score for the question, or undefined when it was typed.
 */
export function maybeMishear(state: RunState, text: string, confidence: number | undefined, puns: readonly Pun[]): Mishear | undefined {
  const since = state.sinceMishear ?? 0;
  state.sinceMishear = since + 1;
  if (state.relaxed || confidence === undefined || confidence <= 0 || confidence >= MISHEAR.confidenceBelow) return undefined;
  if (since < MISHEAR.gap) return undefined;
  const result = applyPun(text, puns);
  if (result) state.sinceMishear = 0;
  return result;
}
