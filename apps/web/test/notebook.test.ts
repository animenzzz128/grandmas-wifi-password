import { describe, expect, it } from "vitest";
import { addPin, extractNotes, PIN_MAX } from "../src/notebook.ts";

describe("notebook extraction", () => {
  it("records names, years, places and numbers from Grandma's words", () => {
    const n = extractNotes(
      "Oh, for heaven's sake. In 1964 we bought the house on Maple Avenue, and we've been there ever since. Our house number is 412. Your grandpa has called me 'Sparrow' since the day we met.",
      "grandma",
    );
    const values = (kind: string) => n.filter((e) => e.kind === kind).map((e) => e.value);
    expect(values("year")).toEqual(["1964"]);
    expect(values("place")).toEqual(["Maple Avenue"]);
    expect(values("name")).toContain("Sparrow");
    expect(values("name")).not.toContain("Oh");
    expect(values("number")).toContain("412");
  });

  it("records painted numbers and carved words from inspect cards", () => {
    const n = extractNotes("A spare wooden house number sign, painted a little crooked: 412. Someone carved MIKEY into the seat.", "object");
    expect(n.map((e) => e.value)).toEqual(expect.arrayContaining(["412", "MIKEY"]));
    expect(n.every((e) => e.from === "object")).toBe(true);
  });
});

describe("notebook noise", () => {
  it("skips sentence starts, contractions, months and articles", () => {
    const n = extractNotes(
      "Pardon, dear? Don't tell your grandfather I said that. The Cherry Street apartment was number 27. Next to it on the cabinet stands a plate: APOLLO 11 · JULY 20, 1969.",
      "grandma",
    );
    const names = n.filter((e) => e.kind === "name").map((e) => e.value);
    expect(names).toEqual([]);
    expect(n.filter((e) => e.kind === "place").map((e) => e.value)).toEqual(["Cherry Street"]);
    expect(n.filter((e) => e.kind === "number").map((e) => e.value)).toEqual(["27"]);
  });

  it("ignores caps phrases on plaques but keeps a single carved name", () => {
    const n = extractNotes("A little gold bowling pin trophy. The plaque says: TUESDAY LEAGUE, HIGH GAME, 212. Someone carved MIKEY into the seat.", "object");
    expect(n.filter((e) => e.kind === "name").map((e) => e.value)).toEqual(["MIKEY"]);
  });
});

describe("pinning quotes", () => {
  it("tidies whitespace and ignores tiny or duplicate quotes", () => {
    let pins = addPin([], "  Walt proposed on\n Christmas Eve, 1960 ");
    expect(pins).toEqual(["Walt proposed on Christmas Eve, 1960"]);
    expect(addPin(pins, "ok")).toBe(pins);
    expect(addPin(pins, "Christmas Eve")).toBe(pins);
    pins = addPin(pins, "Biscuit stole every sock");
    expect(pins).toHaveLength(2);
  });

  it("replaces a shorter pin when the player pins the whole sentence around it", () => {
    const pins = addPin(["Maple Avenue"], "In 1964 we bought the house on Maple Avenue.");
    expect(pins).toEqual(["In 1964 we bought the house on Maple Avenue."]);
  });

  it("cuts very long quotes at a word", () => {
    const long = "word ".repeat(100);
    const [pin] = addPin([], long);
    expect(pin!.length).toBeLessThanOrEqual(PIN_MAX + 1);
    expect(pin!.endsWith("word…")).toBe(true);
  });
});
