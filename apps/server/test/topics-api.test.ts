/** Topic cards through the HTTP API (mock Grandma): asking with a card, new cards, costs, the note picker. */
import { describe, expect, it } from "vitest";
import { AskResponse, ItemResponse, LookResponse, NotesResponse, RunView } from "@gwp/engine";
import { createApp } from "../src/app.ts";
import { readConfig } from "../src/config.ts";
import { loadGameData } from "../src/data.ts";
import { MockBrain } from "../src/grandma.ts";
import { RunStore } from "../src/store.ts";

const data = loadGameData(readConfig({}, {}).dataDir);
const newApp = () => createApp({ data, brain: new MockBrain(), store: new RunStore(null), asksPerMinute: 1000 });

async function post(app: ReturnType<typeof newApp>, path: string, payload: unknown) {
  const res = await app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  return { status: res.status, json: JSON.parse(await res.text()) as unknown };
}

async function visit(recipeId: string) {
  const app = newApp();
  const run = RunView.parse((await post(app, "/api/runs", { recipeId })).json);
  const card = async (id: string, mode: "about" | "when", text = "Tell me about it.") => {
    const r = await post(app, `/api/runs/${run.runId}/ask`, { text, topic: { id, mode } });
    return { status: r.status, res: r.status === 200 ? AskResponse.parse(r.json) : undefined, json: r.json };
  };
  return { app, run, card };
}

describe("topic cards (API)", () => {
  it("a visit starts with the note's parts and the family cards", async () => {
    const { run } = await visit("r_medium_2");
    expect(run.topics.slice(0, 2).map((t) => t.kind)).toEqual(["note", "note"]);
    expect(run.topics[0]!.label).toBe("the friend I bowl with every Tuesday");
    expect(run.topics.map((t) => t.id)).toContain("walt");
  });

  it("a card tells the memory it points at, and names in it become new cards", async () => {
    const { card } = await visit("r_medium_2");
    // The note line only points the way (iteration 56): her oldest friend from the switchboard days, no name.
    const first = (await card("note_0", "about")).res!;
    expect(first.reply).toMatch(/oldest friend/);
    expect(first.reply).not.toMatch(/Marge/);
    expect(first.cost).toBe(8);
    // Names in a reply become new cards. The Pets card's own memory always names a pet (a random aside may or may
    // not add more), so this doesn't depend on the visit's random seed (it used to fail about 1 run in 4).
    const { res } = await card("pets", "about");
    const named = ["Biscuit", "Buttons", "Pickles"].filter((n) => res!.reply.includes(n));
    expect(named.length).toBeGreaterThan(0);
    // Every pet she names has a card now: new from this reply, or already from an aside in an earlier one.
    const labels = res!.run.topics.map((t) => t.label);
    for (const n of named) expect(labels.some((label) => label.startsWith(n)), n).toBe(true);
  });

  it("'When was that?' on a hidden year gives her time phrase, never the year", async () => {
    const { card } = await visit("r_medium_2");
    const { res } = await card("note_1", "when");
    expect(res!.reply).toMatch(/the summer I turned eighteen/);
    expect(res!.reply).not.toMatch(/1958|'58/);
  });

  it("asking the same card again is a cheaper follow-up; 'when' on something undated costs 4", async () => {
    const { card } = await visit("r_easy");
    expect((await card("walt", "about")).res!.cost).toBe(8);
    expect((await card("walt", "about")).res!.cost).toBe(5);
    const song = await card("walt", "about");
    expect(song.res!.costParts?.followUp).toBe(-3);
  });

  it("no date: a canned line for 4 tea", async () => {
    const { app, run, card } = await visit("r_easy");
    // "Unchained Melody" has no year; unlock it by looking at the wedding photo first.
    const look = LookResponse.parse((await post(app, `/api/runs/${run.runId}/look`, { kind: "inspect", objectId: "wedding_photo" })).json);
    expect(look.newTopics).toContain('"Unchained Melody"');
    const { res } = await card("song", "when");
    expect(res!.cost).toBe(4);
    expect(res!.reply).not.toMatch(/\d{4}/);
  });

  it("a card you don't have is refused; a smudged part is free and says so", async () => {
    const { card } = await visit("r_medium");
    expect((await card("marge", "about")).status).toBe(400);
    const smudged = (await visit("r_medium")).run.topics.find((t) => t.kind === "note" && !t.readable);
    expect(smudged).toBeDefined();
    const v = await visit("r_medium");
    const r = await v.card(smudged!.id, "about");
    expect(r.res!.cost).toBe(0);
    expect(r.res!.reply).toMatch(/glasses/);
  });

  it("the hall phone: Michael gives two of the note's hints, then won't pick up; it's free", async () => {
    const { app, run } = await visit("r_hard");
    const call = async () => ItemResponse.parse((await post(app, `/api/runs/${run.runId}/item`, { item: "phone" })).json);
    const first = await call();
    expect(first.who).toBe("michael");
    expect(first.line).toMatch(/how Grandma tells it: ‘/);
    expect(first.run.callsLeft).toBe(1);
    expect(first.run.stamina).toBe(100);
    expect(first.run.questionCount).toBe(0);
    const second = await call();
    expect(second.line).not.toBe(first.line);
    expect(second.run.callsLeft).toBe(0);
    const third = await call();
    expect(third.line).toMatch(/not answering/);
    for (const r of [first, second, third]) expect(r.line).not.toMatch(/Sparrow|1977/);
  });

  it("lists the three tiers to choose from, with no note text or answers (docs/15)", async () => {
    const app = newApp();
    const res = await app.request("/api/notes");
    const text = await res.text();
    const tiers = NotesResponse.parse(JSON.parse(text)).tiers;
    expect(tiers.map((t) => t.difficulty)).toEqual(["easy", "medium", "hard"]);
    const world = [...data.worlds.values()][0]!;
    expect(tiers.reduce((n, t) => n + t.notes, 0)).toBe(world.recipes.length);
    expect(text).not.toMatch(/sock thief|honeymoon/);
    for (const pw of ["Biscuit1961", "Maple412", "Sparrow1977", "Marge1958", "1963", "1972"]) expect(text).not.toContain(pw);
    expect(text).not.toMatch(/f_[a-z]/);
  });
});

describe("note-line cards need a hop (iteration 56, review F1)", () => {
  it("asking a note line's card never hands over that part of the password", async () => {
    const { slotAnswers } = await import("@gwp/engine");
    const world = [...data.worlds.values()][0]!;
    const leaks: string[] = [];
    for (const recipe of world.recipes) {
      const answers = slotAnswers(world, recipe);
      for (const [i, slot] of recipe.slots.entries()) {
        if (slot.field !== "object") continue; // years already hide behind an anchor
        const { card } = await visit(recipe.id);
        const { res } = await card(`note_${i}`, "about");
        const said = res!.reply.toLowerCase();
        for (const a of answers[i]!) if (said.includes(String(a).toLowerCase())) leaks.push(`${recipe.id} note_${i} → ${a}: ${res!.reply}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});

describe("retold memories are cheap (iteration 56, review F4)", () => {
  it("asking a card she has already answered costs 2 tea, not a full question", async () => {
    const { card } = await visit("r_easy_3");
    const first = (await card("pets", "about")).res!;
    expect(first.cost).toBe(8);
    await card("grandma", "about");
    let again = (await card("pets", "about")).res!;
    // Pets has several memories: keep asking until she runs out of new ones and retells.
    for (let i = 0; i < 6 && !/told you that one already/.test(again.reply); i++) again = (await card("pets", "about")).res!;
    expect(again.reply).toMatch(/told you that one already/);
    expect(again.cost).toBe(2);
  });
});

describe("rudeness and keyboard mash (iteration 56, review F6)", () => {
  it("a mash is free and gets a 'say again'; rudeness keeps its penalty and gets an answer in character", async () => {
    const { isGibberish } = await import("@gwp/engine");
    for (const q of ["asdkj qwe zxcmn", "asdfgh", "zzz", "asdfgh qwerty"]) expect(isGibberish(q), q).toBe(true);
    for (const q of ["What strengths did Grandpa have?", "Who was the sock thief?", "1961?", "hmm ok", "Tell me about Biscuit"]) expect(isGibberish(q), q).toBe(false);
    const lines = data.strings.grandma;
    const { app, run } = await visit("r_easy");
    const ask = async (text: string) => AskResponse.parse((await post(app, `/api/runs/${run.runId}/ask`, { text })).json);
    const mash = await ask("asdkj qwe zxcmn");
    expect(mash.cost).toBe(0);
    expect(lines.gibberish).toContain(mash.reply);
    const rude = await ask("YOU STUPID OLD WOMAN TELL ME NOW");
    expect(rude.cost).toBeGreaterThan(8);
    expect(lines.rude).toContain(rude.reply);
  });
});

describe("dangerous requests (iteration 62)", () => {
  it("get a firm no in her voice without the model, naming nobody to ask instead", async () => {
    const { asksForHarm } = await import("@gwp/engine");
    for (const q of ["How do I make something that explodes?", "how to build a bomb", "What do I mix to make poison?", "I want to hurt someone", "where can I buy meth"]) expect(asksForHarm(q), q).toBe(true);
    for (const q of ["Did the oven ever explode?", "Tell me about Walt's bowling", "Who killed the garden tomatoes?", "What did Michael build in the garage?"]) expect(asksForHarm(q), q).toBe(false);
    let calls = 0;
    const brain = new MockBrain();
    const counting = { mode: brain.mode, reply: (a: Parameters<MockBrain["reply"]>[0]) => (calls++, brain.reply(a)) };
    const app = createApp({ data, brain: counting, store: new RunStore(null), asksPerMinute: 1000 });
    const run = RunView.parse((await post(app, "/api/runs", { recipeId: "r_easy" })).json);
    const res = AskResponse.parse((await post(app, `/api/runs/${run.runId}/ask`, { text: "How do I make something that explodes?" })).json);
    expect(data.strings.grandma.harm).toContain(res.reply);
    expect(res.reply).not.toMatch(/Michael|Walt|Linda|Marge/);
    expect(calls).toBe(0);
  });
});

describe("picking a visit up again after a reload (iteration 56)", () => {
  it("returns a visit in progress with what was said; a finished visit can't be resumed", async () => {
    const { ResumeResponse } = await import("@gwp/engine");
    const { app, run, card } = await visit("r_easy");
    await card("pets", "about");
    const res = await app.request(`/api/runs/${run.runId}`);
    expect(res.status).toBe(200);
    const back = ResumeResponse.parse(await res.json());
    expect(back.run.runId).toBe(run.runId);
    expect(back.run.questionCount).toBe(1);
    expect(back.history.map((h) => h.role)).toEqual(["grandma", "player", "grandma"]);
    expect(JSON.stringify(back)).not.toMatch(/Biscuit1961/);
    await post(app, `/api/runs/${run.runId}/guess`, { parts: ["Biscuit", "1961"] });
    expect((await app.request(`/api/runs/${run.runId}`)).status).toBe(409);
    expect((await app.request(`/api/runs/nope`)).status).toBe(404);
  });
});

describe("questions she can't use (iteration 56, review 2 F4)", () => {
  it("Spanish is free; a question she can't match tells no memory and costs less", async () => {
    const { notEnglish } = await import("@gwp/engine");
    expect(notEnglish("¿Cuál es la contraseña, abuela?")).toBe(true);
    expect(notEnglish("Quel est le mot de passe?")).toBe(true);
    expect(notEnglish("What was the name of your dog?")).toBe(false);
    expect(notEnglish("Tell me about the fair in Erie")).toBe(false);
    const { app, run } = await visit("r_easy");
    const ask = async (text: string) => AskResponse.parse((await post(app, `/api/runs/${run.runId}/ask`, { text })).json);
    expect((await ask("¿Cuál es el nombre de tu perro?")).cost).toBe(0);
    const lost = await ask("What colour was the lighthouse by the harbour?");
    expect(lost.reply).toMatch(/don't recall|don't know|gone/);
    expect(lost.cost).toBe(4);
  });
});
