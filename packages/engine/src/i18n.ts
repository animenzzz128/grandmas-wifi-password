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
