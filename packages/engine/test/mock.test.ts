import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isSmallTalk, mockGrandmaReply, parseWorld } from "../src/index.ts";

const data = join(dirname(fileURLToPath(import.meta.url)), "../../../data");
const rosie = parseWorld(JSON.parse(readFileSync(join(data, "grandmas/rosie.json"), "utf8")));

describe("names unlock cards only as names (iteration 56, review 3 F9)", () => {
  it("'dill pickles' in the fridge isn't Pickles the cat", async () => {
    const { discoverTopics } = await import("../src/index.ts");
    expect(discoverTopics(rosie, "a jar of dill pickles, apples in the crisper", [])).not.toContain("pickles");
    expect(discoverTopics(rosie, "We had a grumpy orange cat named Pickles in the eighties.", [])).toContain("pickles");
  });
});

describe("the offline Grandma's asides (iteration 56)", () => {
  it("never tells a part of the password as a random aside", () => {
    // Found in play: "asdfgh qwerty" on Medium got "Our house number is 412", half of Maple412.
    const offTopic = ["asdfgh qwerty", "banana phone", "zzz", "what is love", "tell me something", "do you like jazz", "purple monkey dishwasher"];
    for (const recipe of rosie.recipes) {
      const slots = new Set(recipe.slots.map((s) => s.fact_id));
      for (let i = 0; i < 40; i++)
        for (const q of offTopic) {
          const out = mockGrandmaReply({ world: rosie, recipe, input: { kind: "ask", text: q }, seed: `${q}#${i}`, recentFactIds: [] });
          for (const id of out.distractor_ids) expect(slots.has(id), `${recipe.id}: "${q}" told ${id}`).toBe(false);
        }
    }
  });

  it("answers small talk warmly, without a memory", () => {
    for (const q of ["How are you today, Grandma?", "hi", "Hello!", "Thank you", "how's it going", "Good morning Grandma"]) expect(isSmallTalk(q), q).toBe(true);
    for (const q of ["How old are you?", "What year did you get married?", "Tell me about your first dog", "Who was the sock thief?", "Hi grandma, where did you live when you got the color TV, and what street was it on?"]) expect(isSmallTalk(q), q).toBe(false);
    const recipe = rosie.recipes[0]!;
    const out = mockGrandmaReply({ world: rosie, recipe, input: { kind: "ask", text: "How are you today, Grandma?" }, seed: "x", recentFactIds: [] });
    expect(out.fact_ids_used).toEqual([]);
    expect(rosie.profile.small_talk).toContain(out.reply);
  });
});
