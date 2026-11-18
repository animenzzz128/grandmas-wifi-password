/** OpenRouter access (iteration 62), tested with a fake fetch: no key, no network, no cost. */
import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { costUsd, createRunState, recipeById } from "@gwp/engine";
import { readConfig } from "../src/config.ts";
import { loadGameData } from "../src/data.ts";
import { LlmBrain } from "../src/grandma.ts";
import { OpenRouterError, openRouterClient, openRouterModel } from "../src/openrouter.ts";

const data = loadGameData(readConfig({}, {}).dataDir);
const world = data.worlds.get("rosie")!;
const easy = recipeById(world, "r_easy")!;
const run = () => createRunState({ id: "r1", world, recipe: easy, sceneId: "s", greeting: "Hello dear" });
const good = { reply: "My very first dog was Biscuit, a beagle.", fact_ids_used: ["f_dog1"], distractor_ids: [], mood: "happy" };

type Body = { model: string; messages: { role: string; content: unknown }[]; response_format?: { json_schema: { strict: boolean; schema: Record<string, unknown> } }; reasoning?: unknown; provider: Record<string, unknown> };

function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const sent: { url: string; headers: Record<string, string>; body: Body }[] = [];
  let i = 0;
  const f = (async (url: string, init: RequestInit) => {
    sent.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) as Body });
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, sent };
}

const completion = (content: string, extra: Record<string, unknown> = {}) => ({
  choices: [{ finish_reason: "stop", message: { content } }],
  usage: { prompt_tokens: 2400, completion_tokens: 60, cost: 0.00031, prompt_tokens_details: { cached_tokens: 2000, cache_write_tokens: 0 } },
  ...extra,
});

const brainWith = (f: typeof fetch, model = "claude-haiku-5-5") => new LlmBrain(model, { client: openRouterClient({ apiKey: "sk-or-test", fetch: f }) as unknown as Anthropic });
const args = (text: string) => ({ world, recipe: easy, run: run(), input: { kind: "ask" as const, text }, lines: data.strings.grandma });

describe("OpenRouter config", () => {
  it("an sk-or- key goes to OpenRouter under either name; Claude ids map to OpenRouter's", () => {
    const c = readConfig({}, { ANTHROPIC_API_KEY: "sk-or-v1-abc" });
    expect(c.provider).toBe("openrouter");
    expect(c.apiBaseUrl).toBe("https://openrouter.ai/api/v1");
    expect(c.grandmaModel).toBe("anthropic/claude-haiku-5.5");
    const d = readConfig({}, { OPENROUTER_API_KEY: "sk-or-v1-xyz", ANTHROPIC_API_KEY: "sk-ant-old", GRANDMA_MODEL: "openai/gpt-6-luna" });
    expect(d.apiKey).toBe("sk-or-v1-xyz");
    expect(d.grandmaModel).toBe("openai/gpt-6-luna");
    expect(readConfig({}, { ANTHROPIC_API_KEY: "sk-ant-x" }).provider).toBe("anthropic");
    // Same rule as before: a key some other tool exported is ignored unless deploying on purpose.
    expect(readConfig({ OPENROUTER_API_KEY: "sk-or-ambient" }, {}).grandmaMode).toBe("mock");
    expect(readConfig({ OPENROUTER_API_KEY: "sk-or-fly", GRANDMA_MODE: "llm" }, {}).provider).toBe("openrouter");
  });

  it("maps model ids", () => {
    expect(openRouterModel("claude-haiku-5-5")).toBe("anthropic/claude-haiku-5.5");
    expect(openRouterModel("claude-opus-5-5")).toBe("anthropic/claude-opus-5.5");
    expect(openRouterModel("claude-sonnet-5")).toBe("anthropic/claude-sonnet-5");
    expect(openRouterModel("deepseek/deepseek-v4.1-flash")).toBe("deepseek/deepseek-v4.1-flash");
  });
});

describe("Grandma through OpenRouter", () => {
  it("sends a strict JSON schema, keeps the cache mark on the world block, and only uses private providers", async () => {
    const { f, sent } = fakeFetch([{ body: completion(JSON.stringify(good)) }]);
    const r = await brainWith(f).reply(args("What was your first dog called?"));
    expect(r.fallback).toBe(false);
    expect(r.output.reply).toBe(good.reply);
    const req = sent[0]!;
    expect(req.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(req.headers.authorization).toBe("Bearer sk-or-test");
    expect(req.body.model).toBe("anthropic/claude-haiku-5.5");
    const system = req.body.messages[0]!;
    expect(system.role).toBe("system");
    expect((system.content as { cache_control?: unknown }[])[1]!.cache_control).toEqual({ type: "ephemeral" });
    expect(req.body.messages.at(-1)!.role).toBe("user");
    const schema = req.body.response_format!.json_schema;
    expect(schema.strict).toBe(true);
    // Every node is typed (OpenAI's strict mode needs it); the mood enum came from zod without one.
    expect((schema.schema.properties as Record<string, { type?: string }>).mood!.type).toBe("string");
    expect(req.body.provider).toEqual({ require_parameters: true, data_collection: "deny" });
    // Claude is told not to think (OpenRouter's default for it is to think: 3× slower); another family gets the low effort.
    expect(req.body.reasoning).toEqual({ enabled: false });
    const other = fakeFetch([{ body: completion(JSON.stringify(good)) }]);
    await brainWith(other.f, "openai/gpt-6-luna").reply(args("What was your first dog called?"));
    expect(other.sent[0]!.body.reasoning).toEqual({ effort: "low", exclude: true });
  });

  it("a model that must reason is asked again at low effort, and remembered", async () => {
    const mandatory = { status: 400, body: { error: { code: 400, message: "Reasoning is mandatory for this endpoint and cannot be disabled." } } };
    const { f, sent } = fakeFetch([mandatory, { body: completion(JSON.stringify(good)) }]);
    const brain = brainWith(f, "anthropic/claude-sonnet-5.5");
    const r = await brain.reply(args("What was your first dog called?"));
    expect(r.fallback).toBe(false);
    expect(sent.map((s) => s.body.reasoning)).toEqual([{ enabled: false }, { effort: "low", exclude: true }]);
    await brain.reply(args("And your wedding?"));
    expect(sent).toHaveLength(3);
    expect(sent[2]!.body.reasoning).toEqual({ effort: "low", exclude: true });
  });

  it("counts cached tokens apart and believes OpenRouter's price", async () => {
    const { f } = fakeFetch([{ body: completion(JSON.stringify(good)) }]);
    const r = await brainWith(f).reply(args("What was your first dog called?"));
    expect(r.usage).toEqual({ input: 400, output: 60, cacheRead: 2000, cacheWrite: 0, costUsd: 0.00031 });
    expect(costUsd(r.usage)).toBe(0.00031);
    // Without a reported price, the Haiku table still applies.
    expect(costUsd({ input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(0.1);
  });

  it("output that isn't the schema gets the validator's retry; the second try's cost is added", async () => {
    const { f, sent } = fakeFetch([{ body: completion("Oh my, Biscuit!") }, { body: completion(JSON.stringify(good)) }]);
    const r = await brainWith(f).reply(args("What was your first dog called?"));
    expect(sent).toHaveLength(2);
    expect(r.attempts).toBe(2);
    expect(r.usage!.costUsd).toBeCloseTo(0.00062);
    expect(sent[1]!.body.messages.at(-1)).toMatchObject({ role: "system" });
  });

  it("errors, out of credits and refusals fall back to her free line instead of breaking the turn", async () => {
    for (const r of [{ status: 402, body: { error: { code: 402, message: "Insufficient credits" } } }, { body: { error: { code: 502, message: "provider down" } } }, { body: { choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }], usage: {} } }]) {
      const { f } = fakeFetch([r]);
      const out = await brainWith(f).reply(args("What was your first dog called?"));
      expect(out.fallback).toBe(true);
      expect(data.strings.grandma.fallback).toContain(out.output.reply);
    }
    const { f } = fakeFetch([{ status: 401, body: { error: { code: 401, message: "bad key" } } }]);
    await expect(openRouterClient({ apiKey: "x", fetch: f }).messages.parse({ model: "m", max_tokens: 10, messages: [] })).rejects.toBeInstanceOf(OpenRouterError);
  });
});
