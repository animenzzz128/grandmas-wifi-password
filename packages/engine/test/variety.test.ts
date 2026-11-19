import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMessages, buildSystemPrompt, chainFacts, mockGrandmaReply, parseWorld, recipeById, recentTics, styleNote, varyOpener } from "../src/index.ts";

const world = parseWorld(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../data/grandmas/rosie.json"), "utf8")));
const tics = world.profile.verbal_tics;

describe("catchphrases stay fresh within a visit (docs/14, P6)", () => {
  it("names the tics she just used, and nothing when none", () => {
    expect(styleNote(["Biscuit stole every sock."], tics)).toBeUndefined();
    const note = styleNote(["Oh, for heaven's sake, sweetheart, it was Biscuit."], tics)!;
    expect(note).toContain("Oh, for heaven's sake");
    expect(note).toContain("Sweetheart");
    // Only the last few lines count.
    expect(recentTics(["Oh, for heaven's sake, yes.", "A.", "B.", "C."], tics)).toEqual([]);
  });

  it("drops a worn opener, stacked ones too, and keeps a fresh one", () => {
    const earlier = ["Oh, for heaven's sake, sweetheart, that was Biscuit."];
    expect(varyOpener("Oh, for heaven's sake, sweetheart, my first dog was Biscuit.", earlier, tics)).toBe("My first dog was Biscuit.");
    expect(varyOpener("Oh, for heaven’s sake. Walt proposed with a ring in a pierogi.", earlier, tics)).toBe("Walt proposed with a ring in a pierogi.");
    expect(varyOpener("Now where was I. Walt proposed with a ring in a pierogi.", earlier, tics)).toBe("Now where was I. Walt proposed with a ring in a pierogi.");
    expect(varyOpener("Oh, for heaven's sake, no!", earlier, tics)).toBe("Oh, for heaven's sake, no!"); // too short to stand alone
  });

  it("puts the note in the model's turn, and asks for short replies", () => {
    const history = [
      { role: "grandma" as const, text: "Hello, dear." },
      { role: "player" as const, text: "first dog?" },
      { role: "grandma" as const, text: "Oh, for heaven's sake, it was Biscuit.", factIds: ["f_dog1"] },
    ];
    const msgs = buildMessages(history, { kind: "ask", text: "and the wedding?" }, 90, 6, tics);
    expect(msgs.at(-1)!.content).toContain(`Don't say it in this reply`);
    expect(buildMessages(history, { kind: "ask", text: "and the wedding?" }, 90).at(-1)!.content).not.toContain("Don't say");
    expect(buildSystemPrompt(world, 2026)).toMatch(/25 to 45 words/);
  });
});

describe("offline asides (docs/14, P10)", () => {
  it("never hand over a link of the note's chain, and some are little things", () => {
    let colour = 0;
    for (const recipe of world.recipes) {
      const chain = chainFacts(world, recipe);
      for (let i = 0; i < 40; i++) {
        for (const text of ["What bird did grandpa name you after?", "Tell me about Marge", "Who is Uncle Stan?", "What's your favorite cookie?"]) {
          const out = mockGrandmaReply({ world, recipe: recipeById(world, recipe.id)!, input: { kind: "ask", text }, seed: `${recipe.id}:${i}:${text}`, recentFactIds: [] });
          for (const id of out.distractor_ids) expect(chain.has(id), `${recipe.id} aside ${id}`).toBe(false);
          if ((world.colour ?? []).some((c) => out.reply.includes(c.text))) colour++;
        }
      }
    }
    expect(colour).toBeGreaterThan(100);
  });

  it("doesn't repeat a little thing she already said", () => {
    const recipe = world.recipes[0]!;
    const said = (world.colour ?? []).map((c) => c.text).join(" ");
    for (let i = 0; i < 30; i++) {
      const out = mockGrandmaReply({ world, recipe, input: { kind: "ask", text: "Tell me about Marge" }, seed: `s${i}`, recentFactIds: [], saidText: said });
      for (const c of world.colour ?? []) expect(out.reply).not.toContain(c.text);
    }
  });
});
