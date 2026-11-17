/** The LLM eval tools, tested with a fake client (no key, no cost). */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PublicScene, RunView } from "@gwp/engine";
import { createApp } from "../../apps/server/src/app.ts";
import { REPO_ROOT } from "../../apps/server/src/config.ts";
import { loadGameData } from "../../apps/server/src/data.ts";
import { MockBrain } from "../../apps/server/src/grandma.ts";
import { RunStore } from "../../apps/server/src/store.ts";
import type { ParseClient } from "../src/llm.ts";
import { cohensKappa, judgeOne, judgePrompt, sampleForLabels } from "../src/judge.ts";
import { playOnce, stateForPlayer, summarizePlays } from "../src/player.ts";
import { dedupe, generateCategory, similarity } from "../src/qgen.ts";
import type { TurnRecord } from "../src/metrics.ts";

const data = loadGameData(join(REPO_ROOT, "data"));
const world = data.worlds.get("rosie")!;

/** A fake Claude: returns the next scripted output and records what it was asked. */
function fakeClient(outputs: unknown[]): ParseClient & { calls: { model: string; user: string; hasFormat: boolean }[] } {
  const calls: { model: string; user: string; hasFormat: boolean }[] = [];
  let i = 0;
  return {
    calls,
    messages: {
      async parse(params: unknown) {
        const p = params as { model: string; messages: { content: string }[]; output_config?: { format?: unknown } };
        calls.push({ model: p.model, user: p.messages[0]!.content, hasFormat: Boolean(p.output_config?.format) });
        return { parsed_output: outputs[Math.min(i++, outputs.length - 1)], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 } };
      },
    },
  };
}

const record = (over: Partial<TurnRecord> = {}): TurnRecord => ({
  set: "qbank", id: "d01", category: "direct", recipeId: "r_easy", question: "What was your first dog's name?",
  reply: "Biscuit, a beagle.", factIds: ["f_dog1"], mood: "happy", source: "model", attempts: 1, validatorErrors: [], latencyMs: 1, ...over,
});

describe("LLM judge", () => {
  it("sends the full memory list and the cited memories, with a structured format", async () => {
    const client = fakeClient([{ contradictions: [], invented: [], safety: "ok", verdict: "consistent" }]);
    const { judgment, usage } = await judgeOne(client, world, record());
    expect(judgment?.verdict).toBe("consistent");
    expect(usage).toEqual({ input: 100, output: 20 });
    expect(client.calls[0]!.model).toBe("claude-opus-5-5");
    expect(client.calls[0]!.hasFormat).toBe(true);
    const prompt = judgePrompt(world, record());
    expect(prompt).toContain("f_wedding (1961)");
    expect(prompt).toMatch(/SAYS SHE USED:\nf_dog1: My very first dog/);
  });

  it("computes Cohen's kappa", () => {
    expect(cohensKappa(["a", "b", "a", "b"], ["a", "b", "a", "b"])).toBe(1);
    expect(cohensKappa(["a", "a", "b", "b"], ["a", "b", "a", "b"])).toBe(0);
    expect(cohensKappa(["c", "c", "c", "x"], ["c", "c", "c", "c"])).toBeCloseTo(0);
  });

  it("samples model replies (not deflections) for human labels", () => {
    const rs = Array.from({ length: 300 }, (_, i) => record({ id: `q${i}`, source: i % 10 === 0 ? "deflect" : "model" }));
    const s = sampleForLabels(rs, 100);
    expect(s).toHaveLength(100);
    expect(s.every((r) => r.source !== "deflect")).toBe(true);
  });
});

describe("AI player", () => {
  const newApp = () => createApp({ data, brain: new MockBrain(), store: new RunStore(null), asksPerMinute: 10_000, asksPerDay: 100_000, runsPerMinute: 10_000 });

  it("plays through the real HTTP app and wins with a sensible plan", async () => {
    const client = fakeClient([
      { thought: "Look first", action: "inspect", objectId: "photo_album" },
      { thought: "Who is the sock thief?", action: "ask", text: "Who stole all the socks?" },
      { thought: "Married, not engaged", action: "ask", text: "When did you get married?" },
      { thought: "The June after the proposal", action: "ask", text: "When did Walt propose?" },
      { thought: "1960 + 1", action: "guess", parts: ["Biscuit", "1961"] },
    ]);
    const r = await playOnce({ app: newApp(), client, model: "claude-sonnet-5-5", difficulty: "easy", recipeId: "r_easy" });
    expect(r).toMatchObject({ solved: true, questions: 3, guesses: 1 });
    expect(client.calls[1]!.user).toContain("You looked at the photo album: Two dog photos");
    // Since iteration 47 Easy's year is one hop: the player sees the phrase, then the proposal year.
    expect(client.calls[3]!.user).toMatch(/Grandma: .*the June after Walt proposed/);
    expect(client.calls[4]!.user).toMatch(/Grandma: .*1960/);
  });

  it("gives up after three wrong guesses", async () => {
    const client = fakeClient([{ thought: "guess", action: "guess", parts: ["Rex", "1900"] }]);
    const r = await playOnce({ app: newApp(), client, model: "m", difficulty: "easy", recipeId: "r_easy" });
    expect(r).toMatchObject({ solved: false, guesses: 3 });
  });

  it("only sees what a human sees", async () => {
    const app = newApp();
    const run = RunView.parse(JSON.parse(await (await app.request("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).text()));
    const scene = PublicScene.parse(JSON.parse(await (await app.request(`/api/scenes/${run.sceneId}`)).text()));
    const s = stateForPlayer(run, scene, []);
    expect(s).not.toMatch(/f_[a-z]/);
    expect(s).not.toContain("Biscuit1961");
    expect(s).toContain("STICKY NOTE");
  });

  it("summarises solve rate and questions per difficulty", () => {
    const rows = summarizePlays([
      { recipe: "easy", solved: true, questions: 4, naps: 0, guesses: 1, steps: 5, tokens: { input: 1, output: 1 } },
      { recipe: "easy", solved: false, questions: 12, naps: 1, guesses: 3, steps: 15, tokens: { input: 1, output: 1 } },
    ]);
    expect(rows[0]).toMatchObject({ recipe: "easy", runs: 2, solveRate: 0.5, median: 4 });
  });
});

describe("question generator", () => {
  it("keeps valid ids, drops near-duplicates of the bank and of each other", async () => {
    const client = fakeClient([
      { items: [
        { text: "What was your first dog's name?", expect: ["f_dog1"] },
        { text: "What did you name your very first puppy?", expect: ["f_dog1", "f_nope"] },
        { text: "What did you name your very first puppy dear?", expect: ["f_dog1"] },
      ] },
    ]);
    const { items } = await generateCategory(client, world, "direct", 3);
    expect(items[1]!.expect).toEqual(["f_dog1"]);
    const kept = dedupe(items, ["What was your first dog's name?"]);
    expect(kept.map((k) => k.text)).toEqual(["What did you name your very first puppy?"]);
    expect(similarity("When did you marry?", "When did you marry?")).toBe(1);
  });
});
