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
    const { res } = await card("note_0", "about");
    expect(res!.reply).toMatch(/Marge/);
    expect(res!.newTopics).toContain("Marge Novak");
    expect(res!.run.topics.find((t) => t.id === "marge")?.fresh).toBe(true);
    expect(res!.cost).toBe(8);
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
    // "Moon River" has no year; unlock it by looking at the wedding photo first.
    const look = LookResponse.parse((await post(app, `/api/runs/${run.runId}/look`, { kind: "inspect", objectId: "wedding_photo" })).json);
    expect(look.newTopics).toContain('"Moon River"');
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
    expect(first.line).toMatch(/Grandma always says/);
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

  it("lists the notes to choose from without any answers", async () => {
    const app = newApp();
    const res = await app.request("/api/notes");
    const text = await res.text();
    const notes = NotesResponse.parse(JSON.parse(text)).notes;
    expect(notes).toHaveLength(8);
    expect(notes[0]!.difficulty).toBe("easy");
    for (const pw of ["Biscuit1961", "Maple412", "Sparrow1977", "Marge1958", "1963", "1972"]) expect(text).not.toContain(pw);
    expect(text).not.toMatch(/f_[a-z]/);
  });
});
