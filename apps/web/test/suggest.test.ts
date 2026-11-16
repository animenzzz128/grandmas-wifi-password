import { describe, expect, it } from "vitest";
import { askablePart, suggestions } from "../src/suggest.ts";

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
    expect(askablePart("the street we lived on the year we got the col█r TV ")).toBe("the street we lived on");
    expect(askablePart("the street we lived on the year we got the color TV")).toBe("the street we lived on");
    expect(askablePart(" the number Grandpa painted crooked")).toBe("the number Grandpa painted crooked");
  });

  it("offers the object just looked at, then the note, then a follow-up, at most three", () => {
    const s = suggestions({ note: "the sock thief + the year we said 'I do'", asked: [], lastObject: "old sled", answered: true, words });
    expect(s).toEqual(["Tell me about the old sled", "Do you remember the sock thief?", "Do you remember the year we said 'I do'?"]);
  });

  it("drops what was already asked (any case)", () => {
    const s = suggestions({ note: "the sock thief + the year we said 'I do'", asked: ["do you remember the sock thief?"], answered: true, words });
    expect(s).toEqual(["Do you remember the year we said 'I do'?", "And then what happened?"]);
  });

  it("starts with just the note before Grandma has said anything", () => {
    const s = suggestions({ note: "the bird Grandpa named me after + year of the big snowstorm + !", asked: [], answered: false, words });
    expect(s).toEqual(["Do you remember the bird Grandpa named me after?", "Do you remember the year of the big snowstorm?"]);
  });
});
