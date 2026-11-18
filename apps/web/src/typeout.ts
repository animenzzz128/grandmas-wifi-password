/**
 * Grandma's new lines type out in the chat, the way the design's speech bubble does (GDD §8.1).
 * Pure helpers here; the ChatLog component drives them. Reading is never blocked: a click or the next
 * question shows everything at once, and a setting (or reduced motion) turns it off.
 */

export type Reveal = "full" | "typing" | "hidden";

interface Line {
  who: "grandma" | "player" | "system" | "michael";
  seq?: number;
}

/**
 * How to show each line: every Grandma line newer than `revealed` waits its turn; the oldest of them
 * types, the rest stay hidden until it's done. Anything before the player's latest question counts as
 * read (they moved on). Lines without a seq (the greeting) are shown in full.
 */
export function revealPlan(log: readonly Line[], revealed: number): Reveal[] {
  let upTo = revealed;
  for (const l of log) if (l.who === "player" && l.seq !== undefined) upTo = Math.max(upTo, l.seq);
  let typing = false;
  return log.map((l) => {
    if (l.who !== "grandma" || l.seq === undefined || l.seq <= upTo) return "full";
    if (typing) return "hidden";
    typing = true;
    return "typing";
  });
}

/** Characters per second, and the longest any one line may take. */
export const TYPE_CPS = 55;
export const TYPE_MAX_MS = 3500;

/** How much of `text` shows after `ms`: whole words only, so words don't flicker in letter by letter. */
export function typedLength(text: string, ms: number): number {
  const cps = Math.max(TYPE_CPS, (text.length * 1000) / TYPE_MAX_MS);
  const n = Math.floor((ms / 1000) * cps);
  if (n >= text.length) return text.length;
  const space = text.lastIndexOf(" ", n);
  return space > 0 ? space : 0;
}
