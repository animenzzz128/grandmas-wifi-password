/**
 * The LLM brain's request flow, tested with a fake Anthropic client (no key, no cost):
 * config A vs B system blocks, and the validator's retry with a rejection note.
 */
import { describe, expect, it } from "vitest";
import { createRunState, recipeById, retrieveFacts, buildWorldBlock } from "@gwp/engine";
import type Anthropic from "@anthropic-ai/sdk";
import { readConfig } from "../src/config.ts";
import { loadGameData } from "../src/data.ts";
import { LlmBrain } from "../src/grandma.ts";

const data = loadGameData(readConfig({}, {}).dataDir);
const world = data.worlds.get("rosie")!;
const easy = recipeById(world, "r_easy")!;
const hard = recipeById(world, "r_hard")!;

type Params = { system: { type: string; text: string; cache_control?: unknown }[]; messages: { role: string; content: unknown }[]; output_config: { effort: string } };

function fake(outputs: unknown[]) {
  const calls: Params[] = [];
  let i = 0;
  const client = {
    messages: {
      async parse(p: Params) {
        calls.push(p);
        return { parsed_output: outputs[Math.min(i++, outputs.length - 1)], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const run = (recipe = easy) => createRunState({ id: "r1", world, recipe, sceneId: "s", greeting: "Hello dear" });
const ask = (text: string) => ({ kind: "ask" as const, text });
const good = { reply: "My very first dog was Biscuit, a beagle.", fact_ids_used: ["f_dog1"], distractor_ids: [], mood: "happy" };

describe("config B: retrieval", () => {
  it("picks the relevant memory, its confusable partner and the last turn's memories", () => {
    const ids = retrieveFacts(world, ask("What was your first dog called?"), ["f_garden"], { seed: "x" });
    expect(ids).toEqual(expect.arrayContaining(["f_dog1", "f_dog2", "f_garden"]));
    expect(ids.length).toBeLessThan(world.facts.length / 2);
  });

  it("keeps hidden years hidden in a partial world block", () => {
    const ids = retrieveFacts(world, ask("Tell me about the big snowstorm"), [], { seed: "x" });
    const block = buildWorldBlock(world, hard, ids);
    expect(ids).toContain("f_snowstorm");
    expect(block).not.toContain("1977");
    expect(block).not.toContain("f_cookie |");
  });
});

describe("LLM brain request flow (fake client)", () => {
  it("config A sends every memory, cached; config B sends this turn's memories, uncached", async () => {
    const a = fake([good]);
    await new LlmBrain("claude-haiku-5-5", { client: a.client }).reply({ world, recipe: easy, run: run(), input: ask("What was your first dog called?"), lines: data.strings.grandma });
    expect(a.calls[0]!.system[1]!.cache_control).toBeTruthy();
    expect(a.calls[0]!.system[1]!.text).toContain("f_cookie |");
    expect(a.calls[0]!.output_config.effort).toBe("low");

    const b = fake([good]);
    await new LlmBrain("claude-haiku-5-5", { client: b.client }, { context: "retrieval", effort: "medium" }).reply({ world, recipe: easy, run: run(), input: ask("What was your first dog called?"), lines: data.strings.grandma });
    expect(b.calls[0]!.system[1]!.cache_control).toBeUndefined();
    expect(b.calls[0]!.system[1]!.text).toContain("f_dog1 |");
    expect(b.calls[0]!.system[1]!.text).not.toContain("f_cookie |");
    expect(b.calls[0]!.output_config.effort).toBe("medium");
  });

  it("retries once with the validator's note, then accepts a clean reply", async () => {
    const bad = { reply: "We married in 1959 in Paris.", fact_ids_used: ["f_wedding"], distractor_ids: [], mood: "happy" };
    const f = fake([bad, good]);
    const r = await new LlmBrain("claude-haiku-5-5", { client: f.client }).reply({ world, recipe: easy, run: run(), input: ask("When did you marry?"), lines: data.strings.grandma });
    expect(r).toMatchObject({ attempts: 2, fallback: false });
    expect(r.output.reply).toContain("Biscuit");
    const note = f.calls[1]!.messages.at(-1)!;
    expect(note.role).toBe("system");
    expect(String(note.content)).toMatch(/rejected by the game's fact checker/);
  });

  it("falls back to a canned line after two bad replies", async () => {
    const bad = { reply: "My first dog was Elvis.", fact_ids_used: ["f_dog1"], distractor_ids: [], mood: "happy" };
    const f = fake([bad, bad]);
    const r = await new LlmBrain("claude-haiku-5-5", { client: f.client }).reply({ world, recipe: easy, run: run(), input: ask("First dog?"), lines: data.strings.grandma });
    expect(r.fallback).toBe(true);
    expect(data.strings.grandma.fallback).toContain(r.output.reply);
  });
});

describe("running summary (TDD §5④)", () => {
  it("a long visit sends the last 6 exchanges plus a summary of the memories told before them, without touching the cached blocks", async () => {
    const r = run();
    r.history.push({ role: "player", text: "first dog?" }, { role: "grandma", text: "Biscuit, a beagle.", factIds: ["f_dog1"] });
    for (let i = 0; i < 7; i++) r.history.push({ role: "player", text: `garden ${i}?` }, { role: "grandma", text: "Tomatoes.", factIds: ["f_garden"] });
    const f = fake([good]);
    await new LlmBrain("claude-haiku-5-5", { client: f.client }).reply({ world, recipe: easy, run: r, input: ask("And your wedding?"), lines: data.strings.grandma });
    const sent = f.calls[0]!;
    const last = sent.messages.at(-1)!.content as string;
    expect(last).toMatch(/^And your wedding\?/);
    expect(last).toMatch(/Earlier in this visit.*f_dog1, f_garden/);
    expect(sent.messages.filter((m) => m.role === "assistant")).toHaveLength(6);
    // The summary rides in the new user turn; the cached system blocks are unchanged.
    expect(sent.system.map((s) => s.text).join()).not.toContain("Earlier in this visit");
  });
});
