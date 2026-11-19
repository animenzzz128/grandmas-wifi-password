/**
 * Keeping her catchphrases fresh within one visit (playability review, docs/14, P6). In the eval, 78% of the
 * model's replies opened with "Oh, for heaven's sake" and 64% said "sweetheart": charming once, wearing by the
 * fifth question. Two layers, both in code:
 * - styleNote(): a per-turn note in the prompt naming the tics she used in her last few lines, so she picks
 *   another way in (the model words it; the game decides what's worn out).
 * - varyOpener(): a guarantee after the fact. A reply that opens with the same tic as one of her last lines
 *   loses that opener ("Oh, for heaven's sake, Biscuit…" → "Biscuit…"). Cutting a leading phrase can't add a
 *   fact or a leak, so it runs after the validator.
 */

/** How many of her latest lines count as "recent". */
export const RECENT_LINES = 3;

const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'");

/** The tic `text` opens with, if any. */
export function leadingTic(text: string, tics: readonly string[]): string | undefined {
  const t = norm(text.trimStart());
  return tics.find((tic) => t.startsWith(norm(tic)));
}

/** Tics she used anywhere in her recent lines, most recent first. */
export function recentTics(earlier: readonly string[], tics: readonly string[]): string[] {
  const recent = earlier.slice(-RECENT_LINES).map(norm);
  return tics.filter((tic) => recent.some((line) => line.includes(norm(tic))));
}

/** The prompt note for this turn, or undefined when nothing is worn yet. */
export function styleNote(earlier: readonly string[], tics: readonly string[]): string | undefined {
  const used = recentTics(earlier, tics);
  if (!used.length) return undefined;
  return `[You said ${used.map((t) => `"${t}"`).join(" and ")} a moment ago. Don't say ${used.length > 1 ? "them" : "it"} in this reply; start another way.]`;
}

/**
 * Drop a leading tic she already used in one of her last lines. Keeps the reply as it is when the rest would be
 * too short to stand alone ("Oh, for heaven's sake!").
 */
export function varyOpener(reply: string, earlier: readonly string[], tics: readonly string[]): string {
  const worn = recentTics(earlier, tics);
  let out = reply;
  // Twice at most: "Oh, for heaven's sake, sweetheart, …" can stack two worn tics.
  for (let i = 0; i < 2; i++) {
    const tic = leadingTic(out, tics);
    if (!tic || !worn.includes(tic)) break;
    const rest = out
      .trimStart()
      .slice(tic.length)
      .replace(/^[\s,.!;:…—-]+/, "");
    if (rest.split(/\s+/).filter(Boolean).length < 4) break;
    out = rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return out;
}
