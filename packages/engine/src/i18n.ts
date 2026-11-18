/** Shape of data/i18n/<lang>.json: UI labels for clients, canned lines for the server. */
import { z } from "zod";

const LineBank = z.array(z.string()).min(1);

export const GrandmaLines = z.strictObject({
  greeting: LineBank,
  password_deflect: LineBank,
  wrong_guess: LineBank,
  solved: LineBank,
  out_of_guesses: LineBank,
  nap: LineBank,
  bedtime: LineBank,
  cookie: LineBank,
  no_cookie: LineBank,
  cookie_full: LineBank,
  fallback: LineBank,
  run_over: LineBank,
  /** Out of character on purpose: shown when a player mentions self-harm. Must include help resources. */
  crisis: LineBank,
  /** Free: the player wrote in a language Grandma doesn't read. */
  pardon: LineBank,
  /** Voice mode: she misheard a word. `{as}` / `{As}` is what she heard. Must not mention any facts. */
  misheard: LineBank,
  /** The player put on her reading glasses and can now read the smudged note. */
  glasses_on: LineBank,
  /** Glasses when there's nothing smudged, or already worn. */
  glasses_not_needed: LineBank,
  /** Topic cards: "When was that?" about something with no date. Must not mention any facts. */
  no_year: LineBank,
  /** Rude words at her (the rudeness penalty still applies). In character; no facts (iteration 56). */
  rude: LineBank.optional(),
  /** Asking how to make something dangerous or hurt someone: a firm no, without the model, naming nobody (iteration 62). */
  harm: LineBank.optional(),
  /** Keyboard mash ("asdkj qwe"): free, like a mishearing. No facts (iteration 56). */
  gibberish: LineBank.optional(),
  /** Topic cards: she tells a memory again. Said before it. */
  repeat: LineBank,
  /** Topic cards: a part of the note still smudged. Free. */
  smudged_card: LineBank,
  /** The hall phone: Michael picks up. Followed by the hint, quoted. */
  phone_lead: LineBank,
  /** The hall phone: no more calls, or no more hints. */
  phone_none: LineBank,
});
export type GrandmaLines = z.infer<typeof GrandmaLines>;

/** Voice-mode puns: a word the player might say (`|` between spellings) and what Grandma hears instead. */
export const PunTable = z.array(z.strictObject({ word: z.string().min(2), as: z.string().min(2) })).min(1);

export const Strings = z.strictObject({
  lang: z.string(),
  ui: z.record(z.string(), z.string()),
  grandma: GrandmaLines,
  mishears: PunTable,
});
export type Strings = z.infer<typeof Strings>;

/** Fill `{name}` placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
