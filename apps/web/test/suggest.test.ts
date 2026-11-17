import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { askablePart, suggestions, toAsker } from "../src/suggest.ts";

const words = {
  remember: (p: string) => `Do you remember ${p}?`,
  object: (l: string) => `Tell me about the ${l}`,
  followUp: "And then what happened?",
};

describe("suggested questions (plan A2)", () => {
  it("turns each part of the note into something to ask about", () => {
    expect(askablePart("the sock thief")).toBe("the sock thief");
    expect(askablePart(" year of the big snowstorm")).toBe("the year of the big snowstorm");
    expect(askablePart(" !")).toBeUndefined();
    // Long or smudged parts are cut to their first idea, never past a smudge.
    expect(askablePart("the street we lived on the year we got the col█r TV ")).toBe("the street you lived on");
    expect(askablePart("the street we lived on the year we got the color TV")).toBe("the street you lived on");
    expect(askablePart(" the number Grandpa painted crooked")).toBe("the number Grandpa painted crooked");
    // A smudge that hides the idea itself gets no chip: that's what the reading glasses are for.
    expect(askablePart(" the number Grandpa ███████ ███████")).toBeUndefined();
    expect(askablePart(" year of the big █████████ ")).toBeUndefined();
  });

  it("offers the object just looked at, then the note, then a follow-up, at most three", () => {
    const s = suggestions({ note: "the sock thief + the year we said 'I do'", asked: [], lastObject: "old sled", answered: true, words });
    expect(s).toEqual(["Tell me about the old sled", "Do you remember the sock thief?", "Do you remember the year you said 'I do'?"]);
  });

  it("drops what was already asked (any case)", () => {
    const s = suggestions({ note: "the sock thief + the year we said 'I do'", asked: ["do you remember the sock thief?"], answered: true, words });
    expect(s).toEqual(["Do you remember the year you said 'I do'?", "And then what happened?"]);
  });

  it("starts with just the note before Grandma has said anything", () => {
    const s = suggestions({ note: "the bird Grandpa named me after + year of the big snowstorm + !", asked: [], answered: false, words });
    expect(s).toEqual(["Do you remember the bird Grandpa named you after?", "Do you remember the year of the big snowstorm?"]);
  });
});

describe("chips are in the player's voice", () => {
  it("swaps Grandma's pronouns for the player's, but not inside a quote", () => {
    expect(toAsker("my favorite dog")).toBe("your favorite dog");
    expect(toAsker("the friend I bowl with every Tuesday")).toBe("the friend you bowl with every Tuesday");
    expect(toAsker("where we spent our honeymoon")).toBe("where you spent your honeymoon");
    expect(toAsker("the year your mom was born")).toBe("the year my mom was born");
    expect(toAsker("the year we said 'I do'")).toBe("the year you said 'I do'");
    expect(toAsker("My first home")).toBe("Your first home");
    // Words that only contain a pronoun are left alone.
    expect(toAsker("the mystery of the museum")).toBe("the mystery of the museum");
  });

  it("a question word needs no article", () => {
    expect(askablePart(" where we spent our honeymoon ")).toBe("where you spent your honeymoon");
  });

  it("every recipe's note makes chips that read as the player asking", () => {
    const rosie = JSON.parse(readFileSync(new URL("../../../data/grandmas/rosie.json", import.meta.url), "utf8"));
    const chips: string[] = [];
    for (const r of rosie.recipes) {
      for (const note of [r.note_text, r.smudged_text].filter(Boolean)) {
        for (const chip of suggestions({ note, asked: [], answered: false, words })) {
          chips.push(chip);
          // Grandma's own "I", "me", "we", "us", "our" never reach the player's question, outside a quote.
          // ("my" can be the player's own: "the year my mom was born".)
          const unquoted = chip.replace(/'[^']+'/g, "");
          expect(unquoted, `${r.id}: ${chip}`).not.toMatch(/\b(I|me|we|us|our)\b/);
          expect(chip, `${r.id}: ${chip}`).not.toMatch(/remember the (where|when|who|what|how)\b/);
        }
      }
    }
    expect(chips.length).toBeGreaterThanOrEqual(rosie.recipes.length);
    expect(chips).toContain("Do you remember your favorite dog?");
    expect(chips).toContain("Do you remember where you spent your honeymoon?");
    expect(chips).toContain("Do you remember the year my mom was born?");
  });
});
