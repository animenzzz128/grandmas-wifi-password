import { describe, expect, it } from "vitest";
import { TYPE_MAX_MS, revealPlan, typedLength } from "../src/typeout.ts";

const g = (seq?: number) => ({ who: "grandma" as const, seq });
const p = (seq: number) => ({ who: "player" as const, seq });

describe("type-out of Grandma's lines", () => {
  it("types the oldest unread line and holds the ones after it", () => {
    const log = [g(), p(1), g(2), g(3), { who: "system" as const, seq: 4 }];
    // The system line after them waits too (iteration 56, review 2 F11).
    expect(revealPlan(log, 0)).toEqual(["full", "full", "typing", "hidden", "hidden"]);
    expect(revealPlan(log, 2)).toEqual(["full", "full", "full", "typing", "hidden"]);
    expect(revealPlan(log, 3)).toEqual(["full", "full", "full", "full", "full"]);
  });

  it("counts everything before the player's latest question as read", () => {
    expect(revealPlan([p(1), g(2), g(3), p(4), g(5)], 0)).toEqual(["full", "full", "full", "full", "typing"]);
  });

  it("reveals whole words, and finishes long lines within the cap", () => {
    const text = "Biscuit stole every sock in the house.";
    const shown = text.slice(0, typedLength(text, 200));
    expect(text.startsWith(shown)).toBe(true);
    expect(shown.endsWith(" ") || shown === "" || text[shown.length] === " ").toBe(true);
    expect(typedLength(text, 0)).toBe(0);
    expect(typedLength(text, 10_000)).toBe(text.length);
    const long = "word ".repeat(200).trim();
    expect(typedLength(long, TYPE_MAX_MS)).toBe(long.length);
    expect(typedLength(long, TYPE_MAX_MS / 2)).toBeLessThan(long.length);
  });
});
