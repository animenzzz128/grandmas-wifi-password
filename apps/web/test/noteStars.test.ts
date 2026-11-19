import { describe, expect, it } from "vitest";
import { loadNoteStars, saveNoteStars, tierOf } from "../src/noteStars.ts";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("best stars per tier (docs/15)", () => {
  it("counts stars saved per note, old ids and generated ids alike, for their tier", () => {
    expect(["r_easy", "r_easy_2", "easy:sock_thief+wedding_year", "r_medium_3", "hard:bird_name+snowstorm_year!"].map(tierOf)).toEqual(["easy", "easy", "easy", "medium", "hard"]);
    const store = memory();
    store.setItem("gwp-note-stars", JSON.stringify({ r_easy_2: 3, r_easy: 1, r_medium: 2 }));
    expect(loadNoteStars(store)).toEqual({ easy: 3, medium: 2 });
  });

  it("keeps the best", () => {
    const store = memory();
    saveNoteStars("hard", 2, store);
    saveNoteStars("hard", 1, store);
    expect(loadNoteStars(store)).toEqual({ hard: 2 });
  });
});
