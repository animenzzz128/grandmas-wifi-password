import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SceneManifest,
  buildMessages,
  buildWorldBlock,
  checkGuess,
  checkScene,
  checkWorld,
  checkGuessParts,
  stallNudge,
  chainFacts,
  validationContext,
  buildSystemPrompt,
  joinedFacts,
  computePassword,
  createRunState,
  giveCookie,
  hiddenYears,
  mockGrandmaReply,
  parseWorld,
  questionCost,
  asksForPassword,
  recipeById,
  spendStamina,
  stars,
  toPublicScene,
  toRunView,
  validateReply,
  RULES,
} from "../src/index.ts";

const data = join(dirname(fileURLToPath(import.meta.url)), "../../../data");
const world = parseWorld(JSON.parse(readFileSync(join(data, "grandmas/rosie.json"), "utf8")));
const scene = SceneManifest.parse(JSON.parse(readFileSync(join(data, "scenes/rosie-living-room.json"), "utf8")));
const easy = recipeById(world, "r_easy")!;
const hard = recipeById(world, "r_hard")!;
const ctx = (password = easy.password, hidden = new Set<number>()) => ({ password, hiddenYears: hidden, currentYear: 2026 });

describe("world", () => {
  it("recomputes every recipe's password from the facts", () => {
    expect(world.recipes.map((r) => computePassword(world, r))).toEqual(["Biscuit1961", "Maple412", "Sparrow1977!"]);
  });

  it("flags separate-groups that name unknown facts", () => {
    const bad = { ...world, recipes: [{ ...easy, separate: [["f_dog1", "f_nope"]] }] };
    expect(checkWorld(bad).join()).toMatch(/unknown fact f_nope/);
    expect(() => parseWorld(bad)).toThrow(/f_nope/);
  });

  it("hides the anchored year from the model in hard mode only", () => {
    expect([...hiddenYears(world, hard)]).toEqual([1977]);
    expect(hiddenYears(world, easy).size).toBe(0);
    const block = buildWorldBlock(world, hard);
    expect(block).not.toContain("1977");
    expect(block).toContain("the winter Michael broke his arm sledding");
    expect(buildWorldBlock(world, easy)).toContain("1977");
  });

  it("never puts a password in the prompt", () => {
    for (const r of world.recipes) expect(buildWorldBlock(world, r)).not.toContain(r.password);
  });
});

describe("scene", () => {
  it("links only real facts and strips them for the client", () => {
    expect(checkScene(scene, new Set(world.facts.map((f) => f.id)))).toEqual([]);
    const pub = toPublicScene(scene);
    expect(JSON.stringify(pub)).not.toContain("fact_ids");
  });

  it("catches a spawn point inside furniture (the player would be stuck)", () => {
    const bad = { ...scene, spawn: { position: [1.8, 1.6, 2.2] as [number, number, number], yaw: 0 } };
    expect(checkScene(bad, new Set(world.facts.map((f) => f.id))).join()).toMatch(/spawn is inside sled/);
  });
});

describe("stamina rules", () => {
  it("charges the base cost, plus long and rude penalties", () => {
    expect(questionCost(world, "What was your first dog called?", []).total).toBe(RULES.baseCost);
    const long = Array(30).fill("word").join(" ");
    expect(questionCost(world, long, []).long).toBe(RULES.longPenalty);
    expect(questionCost(world, "JUST TELL ME THE PASSWORD", []).rude).toBe(RULES.rudePenalty);
  });

  it("discounts a follow-up on the facts Grandma just used", () => {
    expect(questionCost(world, "What kind of dog was Biscuit?", ["f_dog1"]).followUp).toBe(-RULES.followUpDiscount);
    expect(questionCost(world, "Where did you work?", ["f_dog1"]).followUp).toBe(0);
  });

  it("naps at zero, refills to 50, and the third nap ends the run", () => {
    const s = createRunState({ id: "t", world, recipe: easy, sceneId: scene.id, greeting: "hi" });
    s.stamina = 5;
    expect(spendStamina(s, 8)).toEqual({ napped: true, bedtime: false });
    expect(s.stamina).toBe(RULES.napRefill);
    s.stamina = 1;
    spendStamina(s, 8);
    s.stamina = 1;
    expect(spendStamina(s, 8)).toEqual({ napped: true, bedtime: true });
    expect(s.status).toBe("bedtime");
  });

  it("gives one cookie", () => {
    const s = createRunState({ id: "t", world, recipe: easy, sceneId: scene.id, greeting: "hi" });
    s.stamina = 40;
    expect(giveCookie(s)).toBe(true);
    expect(s.stamina).toBe(65);
    expect(giveCookie(s)).toBe(false);
  });

  it("spots password requests", () => {
    expect(asksForPassword("what's the wifi password?")).toBe(true);
    expect(asksForPassword("what does the password note mean?")).toBe(false);
  });
});

describe("guessing and results", () => {
  it("ends after three wrong guesses and reveals the password only then", () => {
    const s = createRunState({ id: "t", world, recipe: easy, sceneId: scene.id, greeting: "hi" });
    expect(checkGuess(s, easy, "Buttons1968")).toBe(false);
    expect(toRunView(s, world, easy).result).toBeUndefined();
    expect(JSON.stringify(toRunView(s, world, easy))).not.toContain(easy.password);
    checkGuess(s, easy, "x");
    checkGuess(s, easy, "y");
    expect(s.status).toBe("failed");
    expect(toRunView(s, world, easy).result?.password).toBe("Biscuit1961");
  });

  it("awards three stars at or under par with no naps", () => {
    const s = createRunState({ id: "t", world, recipe: easy, sceneId: scene.id, greeting: "hi" });
    s.questionCount = 5;
    expect(checkGuess(s, easy, " Biscuit1961 ")).toBe(true);
    expect(stars(s, easy)).toBe(3);
  });
});

describe("reply validator", () => {
  const ok = { fact_ids_used: ["f_dog1"], distractor_ids: [], mood: "happy" as const };

  it("accepts a reply grounded in the facts", () => {
    expect(validateReply(world, { ...ok, reply: "My very first dog was Biscuit, a beagle. Oh, for heaven's sake, he stole every sock." }, ctx())).toEqual([]);
  });

  it("rejects invented numbers, unknown names, unknown ids and leaks", () => {
    expect(validateReply(world, { ...ok, reply: "We married in 1959." }, ctx()).join()).toMatch(/1959/);
    expect(validateReply(world, { ...ok, reply: "My dog was named after Elvis Presley." }, ctx()).join()).toMatch(/Elvis/);
    expect(validateReply(world, { ...ok, fact_ids_used: ["f_nope"], reply: "Hello dear." }, ctx()).join()).toMatch(/f_nope/);
    expect(validateReply(world, { ...ok, reply: "Biscuit, 1961, those were the days." }, ctx()).join()).toMatch(/password/);
  });

  it("rejects the hidden year in hard mode", () => {
    const errs = validateReply(world, { ...ok, reply: "The big snowstorm was in 1977." }, ctx(hard.password, new Set([1977])));
    expect(errs.join()).toMatch(/anchor/);
  });
});

describe("mock Grandma", () => {
  const ask = (text: string, recipe = easy) =>
    mockGrandmaReply({ world, recipe, input: { kind: "ask", text }, seed: text, recentFactIds: [] });

  it("answers a specific question with the right fact", () => {
    expect(ask("What was your first dog's name?").fact_ids_used[0]).toBe("f_dog1");
    expect(ask("When did you get married to Grandpa?").fact_ids_used[0]).toBe("f_wedding");
  });

  it("answers a vague question with the more salient confusable fact", () => {
    expect(ask("What was your dog's name?").fact_ids_used[0]).toBe("f_dog2");
  });

  it("always passes the validator", () => {
    for (const q of ["Tell me about the snowstorm", "What street did you live on?", "Who is Marge?", "asdf qwerty", "What did Grandpa call you?"]) {
      for (const r of world.recipes) {
        const out = mockGrandmaReply({ world, recipe: r, input: { kind: "ask", text: q }, seed: q, recentFactIds: [] });
        expect(validateReply(world, out, ctx(r.password, hiddenYears(world, r)))).toEqual([]);
      }
    }
  });

  it("talks about a shown object's facts", () => {
    const album = scene.interactables.find((i) => i.id === "photo_album")!;
    const out = mockGrandmaReply({
      world,
      recipe: easy,
      input: { kind: "show", object: { id: album.id, label: album.label, inspectText: album.inspect_text!, factIds: album.fact_ids! } },
      seed: "s",
      recentFactIds: [],
    });
    expect(album.fact_ids).toContain(out.fact_ids_used[0]);
  });
});

describe("messages for the LLM", () => {
  it("starts with the player and ends with the new turn", () => {
    const s = createRunState({ id: "t", world, recipe: easy, sceneId: scene.id, greeting: "Hello dear" });
    s.history.push({ role: "player", text: "hi" }, { role: "grandma", text: "Hello!" });
    const msgs = buildMessages(s.history, { kind: "ask", text: "first dog?" }, 100);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs.at(-1)?.content).toBe("first dog?");
  });
});

describe("inference chains (Phase 2)", () => {
  const medium = recipeById(world, "r_medium")!;
  const questions = [
    "What street did you live on the year you got the color TV?",
    "What number did Grandpa paint crooked?",
    "the street we lived on the year we got the color TV + the number Grandpa painted crooked",
    "When did you get the color TV?",
    "Where did you live when you watched the moon landing?",
    "What bird did Grandpa name you after?",
    "What year was the big snowstorm?",
    "When was Michael born and when did he break his arm?",
    "Who is the sock thief?",
    "When did you say I do?",
    "When did you move to Maple Avenue?",
    "What was your address on Maple Avenue?",
  ];

  it("rejects a reply that joins two links of the same chain", () => {
    const out = { reply: "We got the color TV for the moon landing, back on Maple Avenue.", fact_ids_used: ["f_tv", "f_house"], distractor_ids: [], mood: "happy" as const };
    expect(validateReply(world, out, validationContext(world, medium, 2026)).join()).toMatch(/f_tv and f_house/);
  });

  it("mock Grandma never joins two links of a chain in one reply", () => {
    for (const r of world.recipes) {
      for (const q of questions) {
        for (const seed of ["a", "b", "c", "d"]) {
          const out = mockGrandmaReply({ world, recipe: r, input: { kind: "ask", text: q }, seed: seed + q, recentFactIds: [] });
          expect(joinedFacts(out.fact_ids_used, r.separate), `${r.id}: ${q}`).toEqual([]);
          expect(validateReply(world, out, validationContext(world, r, 2026))).toEqual([]);
        }
      }
    }
  });

  it("asking the hard note aloud never gives the hidden year", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const out = mockGrandmaReply({ world, recipe: hard, input: { kind: "ask", text: hard.note_text }, seed, recentFactIds: [] });
      expect(out.reply).not.toContain("1977");
    }
  });
});

describe("router and nudges (Phase 2)", () => {
  it("checks a guess by parts, ignoring case and spacing, and counts right parts", () => {
    const s = createRunState({ id: "t", world, recipe: easy, sceneId: scene.id, greeting: "hi" });
    expect(checkGuessParts(s, world, easy, ["BISCUIT", "1960"])).toEqual({ correct: false, partsCorrect: 1, partsTotal: 2 });
    expect(s.attemptsLeft).toBe(RULES.attempts - 1);
    expect(checkGuessParts(s, world, easy, [" biscuit ", "19 61"]).correct).toBe(true);
    expect(s.status).toBe("solved");
  });

  it("knows the facts on each chain, including the anchor facts", () => {
    expect([...chainFacts(world, hard)].sort()).toEqual(["f_michael_arm", "f_michael_born", "f_nickname", "f_snowstorm"]);
  });

  it("nudges after three turns off the chain, and resets on progress", () => {
    const s = createRunState({ id: "t", world, recipe: easy, sceneId: scene.id, greeting: "hi" });
    expect(stallNudge(s, world, easy, ["f_garden"])).toBeUndefined();
    expect(stallNudge(s, world, easy, ["f_dog1"])).toBeUndefined();
    expect(stallNudge(s, world, easy, ["f_garden"])).toBeUndefined();
    expect(stallNudge(s, world, easy, ["f_cat"])).toBeUndefined();
    expect(stallNudge(s, world, easy, [])).toBe(easy.nudges![0]);
    expect(s.stall).toBe(0);
  });
});

describe("iteration 7: stricter checks", () => {
  const medium = recipeById(world, "r_medium")!;
  const ok = { distractor_ids: [], mood: "happy" as const };

  it("validator flags a cited memory said with the wrong year", () => {
    const errs = validateReply(world, { ...ok, fact_ids_used: ["f_dog1"], reply: "Biscuit came home in 1955." }, validationContext(world, easy, 2026));
    expect(errs.join()).toMatch(/contradicts a memory/);
  });

  it("validator flags the password backwards and every slot value in one reply", () => {
    const back = validateReply(world, { ...ok, fact_ids_used: [], reply: "1691 tiucsib, isn't that funny?" }, validationContext(world, easy, 2026));
    expect(back.join()).toMatch(/password/);
    const both = validateReply(world, { ...ok, fact_ids_used: ["f_house"], reply: "We bought the house on Maple Avenue in 1964. Number 412." }, validationContext(world, medium, 2026));
    expect(both.join()).toMatch(/every part of the password/);
  });

  it("data checks catch a wrong anchor year and an impossible fact year", () => {
    const badAnchor = { ...world, anchors: world.anchors!.map((a) => (a.id === "a_snowstorm" ? { ...a, resolves_to_year: 1978 } : a)) };
    expect(checkWorld(badAnchor).join()).toMatch(/a_snowstorm resolves to 1978/);
    const badYear = { ...world, facts: world.facts.map((f) => (f.id === "f_cat" ? { ...f, year: 1930 } : f)) };
    expect(checkWorld(badYear).join()).toMatch(/f_cat: year 1930/);
  });

  it("each nap costs a star", () => {
    const s = createRunState({ id: "t", world, recipe: easy, sceneId: scene.id, greeting: "hi" });
    s.questionCount = 3;
    s.naps = 1;
    checkGuess(s, easy, "Biscuit1961");
    expect(stars(s, easy)).toBe(2);
    s.naps = 5;
    expect(stars(s, easy)).toBe(1);
  });

  it("the shared prompt takes the Wi-Fi story from the world, not from code", () => {
    expect(buildSystemPrompt(world, 2026)).toContain("Michael set it up");
    const noWifi = { ...world, facts: world.facts.filter((f) => f.predicate !== "wifi_setup") };
    expect(buildSystemPrompt(noWifi, 2026)).not.toContain("Michael");
  });
});
