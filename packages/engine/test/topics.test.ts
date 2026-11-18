/**
 * Topic cards (topics.ts): picking, unlocking, and a fairness bot that plays every puzzle with cards alone
 * (ported from the Godot edition's test_logic.gd). The bot taps every card it has, both buttons, until nothing
 * new turns up, and looks at every object in the room. Every part of every password must then be findable,
 * and no year the note hides may ever be said.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SceneManifest,
  buildMessages,
  retrieveFacts,
  createRunState,
  discoverTopics,
  hasPhrase,
  hiddenYears,
  mockGrandmaReply,
  noteParts,
  noteTopics,
  parseWorld,
  pickTopicFact,
  slotParts,
  startingTopics,
  topicById,
  topicQuestion,
  topicReadable,
  worldTopics,
} from "../src/index.ts";
import type { GrandmaWorld } from "../src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const world = parseWorld(JSON.parse(readFileSync(join(root, "data/grandmas/rosie.json"), "utf8")));
const scene = SceneManifest.parse(JSON.parse(readFileSync(join(root, "data/scenes/rosie-living-room.json"), "utf8")));

describe("topic cards", () => {
  it("matches whole words, and a plural", () => {
    expect(hasPhrase("Every Tuesday is bowling league with Marge.", "Marge")).toBe(true);
    expect(hasPhrase("Margery came by", "Marge")).toBe(false);
    expect(hasPhrase("the dogs lay by the TV", "dog")).toBe(true);
    expect(hasPhrase("the dogsled", "dog")).toBe(false);
    expect(hasPhrase("We went to Erie.", "erie")).toBe(true);
  });

  it("starts with the note's parts, then the world's starting cards", () => {
    const easy = world.recipes.find((r) => r.id === "r_easy")!;
    const start = startingTopics(world, easy);
    expect(start.slice(0, 2)).toEqual(["note_0", "note_1"]);
    expect(start).toContain("walt");
    expect(noteParts("the bird Grandpa named me after + year of the big snowstorm + !")).toHaveLength(2);
  });

  it("a smudged note part can't be asked about until the glasses go on", () => {
    const medium = world.recipes.find((r) => r.id === "r_medium")!;
    const smudged = noteTopics(medium, medium.smudged_text!);
    expect(smudged.some((t) => !topicReadable(t))).toBe(true);
    expect(noteTopics(medium, medium.note_text).every(topicReadable)).toBe(true);
  });

  it("tells the next untold memory, then repeats; 'when' finds the dated one or says there is none", () => {
    const walt = worldTopics(world).find((t) => t.id === "walt")!;
    const first = pickTopicFact(world, walt, "about", [], []);
    expect(first).toEqual({ kind: "fact", factId: walt.facts[0], repeat: false });
    const second = pickTopicFact(world, walt, "about", [walt.facts[0]!], []);
    expect(second.kind === "fact" && second.factId).toBe(walt.facts[1]);
    expect(pickTopicFact(world, walt, "about", walt.facts, [])).toMatchObject({ kind: "fact", repeat: true });
    const song = worldTopics(world).find((t) => t.id === "song")!;
    expect(pickTopicFact(world, song, "when", [], [])).toEqual({ kind: "no_year" });
  });

  it("the player's question reads naturally", () => {
    expect(topicQuestion("Marge Novak", "about", "person")).toBe("Tell me about Marge Novak.");
    expect(topicQuestion("the sock thief", "when", "note")).toBe('"the sock thief": when was that?');
  });

  it("a card's name never says more than the text that unlocked it (no answers from a nameless photo)", () => {
    // The album says "a beagle … nobody wrote the names underneath": unlocking a card labelled "Biscuit" from
    // it would hand over Easy's answer. So a card may only appear from text that already contains its label's
    // name, unless that name is no answer to any note.
    const answers = new Set(world.recipes.flatMap((r) => slotParts(world, r).map((p) => p.toLowerCase())));
    const texts = [...scene.interactables.map((o) => o.inspect_text ?? ""), ...world.facts.map((f) => f.text)];
    for (const text of texts) {
      for (const id of discoverTopics(world, text, [])) {
        const card = worldTopics(world).find((t) => t.id === id)!;
        for (const word of card.label.split(/[^A-Za-z0-9]+/)) {
          if (answers.has(word.toLowerCase())) expect(text.toLowerCase(), `card "${card.label}" from: ${text.slice(0, 60)}`).toContain(word.toLowerCase());
        }
      }
    }
  });

  it("the LLM is told which memory a card picked, and to give its date only as the memory says it", () => {
    const about = buildMessages([{ role: "grandma", text: "Hello" }], { kind: "ask", text: "Tell me about Marge Novak.", focus: { factId: "f_marge", mode: "about" } }, 90);
    expect(about.at(-1)!.content).toMatch(/Tell memory f_marge/);
    const when = buildMessages([{ role: "grandma", text: "Hello" }], { kind: "ask", text: "When was that?", focus: { factId: "f_met_walt", mode: "when", repeat: true } }, 90);
    expect(when.at(-1)!.content).toMatch(/asked when\. Tell memory f_met_walt/);
    expect(when.at(-1)!.content).toMatch(/told them this one already/);
    // Retrieval mode (config B) always includes the picked memory.
    expect(retrieveFacts(world, { kind: "ask", text: "zzz", focus: { factId: "f_cat", mode: "about" } }, [])).toContain("f_cat");
  });

  it("a world without curated cards gets one per entity", () => {
    const bare: GrandmaWorld = { ...world, topics: undefined, start_topics: undefined };
    const cards = worldTopics(bare);
    expect(cards.find((t) => t.id === "marge")?.match).toContain("Marge Novak");
    expect(cards.every((t) => t.facts.length > 0)).toBe(true);
  });
});

/** Every card, both buttons, until nothing new; plus every object. Returns what the player saw. */
function playWithCards(recipeId: string) {
  const recipe = world.recipes.find((r) => r.id === recipeId)!;
  const state = createRunState({ id: `bot-${recipeId}`, world, recipe, sceneId: scene.id, greeting: "Hello, dear." });
  const known = [...(state.topics ?? [])];
  const heard: string[] = [];
  const heardWhen: string[] = [];
  const said: string[] = [];
  const looked: string[] = [];
  let rounds = 0;
  for (let grew = true; grew && rounds < 20; rounds++) {
    grew = false;
    const before = known.length;
    for (const o of scene.interactables) {
      if (!o.inspect_text) continue;
      looked.push(o.inspect_text);
      known.push(...discoverTopics(world, o.inspect_text, known));
    }
    for (const id of [...known]) {
      // The bot has put on the glasses: it reads the whole note.
      const topic = topicById(world, recipe, recipe.note_text, id)!;
      for (const mode of ["about", "when"] as const) {
        for (let i = 0; i < topic.facts.length; i++) {
          const pick = pickTopicFact(world, topic, mode, heard, heardWhen);
          if (pick.kind !== "fact" || pick.repeat) break;
          const out = mockGrandmaReply({ world, recipe, input: { kind: "ask", text: topicQuestion(topic.label, mode, topic.kind), focus: { factId: pick.factId, mode } }, seed: `${id}:${mode}:${i}`, recentFactIds: [] });
          expect(out.fact_ids_used[0]).toBe(pick.factId);
          said.push(out.reply);
          for (const f of out.fact_ids_used) if (!heard.includes(f)) heard.push(f);
          if (mode === "when") heardWhen.push(pick.factId);
          known.push(...discoverTopics(world, out.reply, known));
        }
      }
    }
    grew = known.length > before;
  }
  return { recipe, known, said, looked, rounds, heard };
}

describe("fairness: every puzzle can be solved with cards alone", () => {
  for (const recipe of world.recipes) {
    it(`${recipe.id} (${recipe.note_text})`, () => {
      const { said, looked, known, heard } = playWithCards(recipe.id);
      const all = [...said, ...looked].join("\n");
      const hidden = hiddenYears(world, recipe);
      const parts = slotParts(world, recipe);
      recipe.slots.forEach((slot, i) => {
        if (slot.field === "year" && slot.requires_anchor) {
          // The hidden year is never said; she tells the memory (with its time phrase instead), and the years
          // the phrase leans on are findable.
          const anchor = world.anchors!.find((a) => a.id === slot.requires_anchor)!;
          expect(heard, `${recipe.id}: the memory behind part ${i + 1}`).toContain(slot.fact_id);
          for (const id of anchor.via_fact_ids ?? []) expect(heard, `${recipe.id}: ${id}`).toContain(id);
          for (const id of anchor.via_fact_ids ?? []) {
            const f = world.facts.find((x) => x.id === id)!;
            if (f.year !== undefined && !hidden.has(f.year)) expect(all, `${recipe.id}: year of ${id}`).toContain(String(f.year));
          }
        } else {
          expect(all.toLowerCase(), `${recipe.id}: part ${i + 1}`).toContain(parts[i]!.toLowerCase());
        }
      });
      for (const y of hidden) {
        for (const line of said) {
          expect(line, `${recipe.id} said a hidden year`).not.toMatch(new RegExp(`\\b${y}\\b|'${String(y).slice(2)}\\b`));
        }
      }
      // The trail opens up: the bot ends with many more cards than it started with.
      expect(known.length).toBeGreaterThan(15);
    });
  }
});
