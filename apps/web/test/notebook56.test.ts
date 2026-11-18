import { describe, expect, it } from "vitest";
import { extractNotes } from "../src/notebook.ts";

const names = (text: string, from: "grandma" | "object" = "grandma") => extractNotes(text, from).filter((n) => n.kind === "name").map((n) => n.value);

describe("notebook names and years (iteration 56, review F5)", () => {
  it("keeps accented names whole and multi-word names together", () => {
    expect(names("My mother came over from Kraków in 1922.")).toContain("Kraków");
    expect(names("Our honeymoon was at Niagara Falls, and it rained.")).toEqual(["Niagara Falls"]);
    expect(names("Ask about my friend Marge Novak, she cheats at cards.")).toEqual(["Marge Novak"]);
  });

  it("reads abbreviations and seasons as what they are", () => {
    const n = extractNotes("A later page shows a window labeled 'Cherry St., our first home — moved out summer '64', and a porch labeled 'Summer '69'.", "object");
    expect(n.filter((e) => e.kind === "place").map((e) => e.value)).toContain("Cherry Street");
    expect(n.filter((e) => e.kind === "name").map((e) => e.value)).not.toContain("St");
    expect(n.filter((e) => e.kind === "name").map((e) => e.value)).not.toContain("Summer");
    expect(n.filter((e) => e.kind === "year").map((e) => e.value).sort()).toEqual(["1964", "1969"]);
  });

  it("quotes the sentence a clue came from, not the whole card", () => {
    const n = extractNotes("An old wooden sled leaning by the door. One runner is cracked, and someone carved MIKEY into the seat.", "object");
    expect(n.find((e) => e.value === "MIKEY")!.source).toBe("One runner is cracked, and someone carved MIKEY into the seat.");
  });
});
