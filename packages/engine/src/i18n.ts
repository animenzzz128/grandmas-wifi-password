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
});
export type GrandmaLines = z.infer<typeof GrandmaLines>;

export const Strings = z.strictObject({
  lang: z.string(),
  ui: z.record(z.string(), z.string()),
  grandma: GrandmaLines,
});
export type Strings = z.infer<typeof Strings>;

/** Fill `{name}` placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
