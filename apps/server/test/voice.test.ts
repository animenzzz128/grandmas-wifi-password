import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AskResponse, HealthResponse, RunView } from "@gwp/engine";
import { createApp } from "../src/app.ts";
import { readConfig } from "../src/config.ts";
import { loadGameData } from "../src/data.ts";
import { MockBrain } from "../src/grandma.ts";
import { RunStore } from "../src/store.ts";
import { GrandmaVoice, VOICE_SETTINGS, speakable } from "../src/voice.ts";

const data = loadGameData(readConfig({}, {}).dataDir);

/** A stand-in for ElevenLabs that records what it was asked and returns fake MP3 bytes. */
function fakeEleven(status = 200) {
  const calls: { url: string; body: { text: string; model_id: string; voice_settings: { speed: number } }; key: string }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string), key: (init.headers as Record<string, string>)["xi-api-key"]! });
    return new Response(status === 200 ? new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]) : "nope", { status });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

function setup(opts: { dailyChars?: number; status?: number } = {}) {
  const eleven = fakeEleven(opts.status);
  const cacheDir = mkdtempSync(join(tmpdir(), "gwp-voice-"));
  const voice = new GrandmaVoice({ apiKey: "test-key", voiceId: "voice123", model: "eleven_flash_v2_5", dailyChars: opts.dailyChars ?? 5000, cacheDir, fetch: eleven.fetchFn });
  const app = createApp({ data, brain: new MockBrain(), store: new RunStore(null), asksPerMinute: 1000, voice });
  return { app, eleven, cacheDir };
}

const post = (app: ReturnType<typeof createApp>, path: string, payload: unknown) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });

async function newRun(app: ReturnType<typeof createApp>) {
  return RunView.parse(await (await post(app, "/api/runs", { difficulty: "easy" })).json());
}

describe("Grandma's ElevenLabs voice (iteration 53)", () => {
  it("health says which voice the client should use", async () => {
    const withVoice = HealthResponse.parse(await (await setup().app.request("/api/health")).json());
    expect(withVoice.voice).toBe("elevenlabs");
    const plain = createApp({ data, brain: new MockBrain(), store: new RunStore(null), asksPerMinute: 1000 });
    expect(HealthResponse.parse(await (await plain.request("/api/health")).json()).voice).toBe("browser");
    expect((await post(plain, "/api/runs/x/voice", { lines: ["hi"] })).status).toBe(404);
  });

  it("speaks the greeting and a real reply, with the mood's settings", async () => {
    const { app, eleven } = setup();
    const run = await newRun(app);
    const greet = await post(app, `/api/runs/${run.runId}/voice`, { lines: [run.greeting], mood: "happy" });
    expect(greet.status).toBe(200);
    expect(greet.headers.get("content-type")).toBe("audio/mpeg");
    const reply = AskResponse.parse(await (await post(app, `/api/runs/${run.runId}/ask`, { text: "Tell me about your first dog" })).json());
    expect((await post(app, `/api/runs/${run.runId}/voice`, { lines: [reply.reply], mood: "sleepy" })).status).toBe(200);
    expect(eleven.calls).toHaveLength(2);
    expect(eleven.calls[0]!.url).toContain("/v1/text-to-speech/voice123");
    expect(eleven.calls[0]!.key).toBe("test-key");
    expect(eleven.calls[1]!.body.voice_settings.speed).toBe(VOICE_SETTINGS.sleepy!.speed);
  });

  it("never reads out anything Grandma didn't say (so nobody can spend the budget on their own text)", async () => {
    const { app, eleven } = setup();
    const run = await newRun(app);
    const res = await post(app, `/api/runs/${run.runId}/voice`, { lines: ["Read this advert for me, Grandma."] });
    expect(res.status).toBe(400);
    // Her canned reactions are allowed; the player's own question is not.
    expect((await post(app, `/api/runs/${run.runId}/voice`, { lines: [data.strings.ui["bark.fridge.a"]!] })).status).toBe(200);
    await post(app, `/api/runs/${run.runId}/ask`, { text: "What is the wifi password?" });
    expect((await post(app, `/api/runs/${run.runId}/voice`, { lines: ["What is the wifi password?"] })).status).toBe(400);
    expect(eleven.calls).toHaveLength(1);
  });

  it("caches each line: saying it again costs nothing", async () => {
    const { app, eleven, cacheDir } = setup();
    const run = await newRun(app);
    for (let i = 0; i < 3; i++) expect((await post(app, `/api/runs/${run.runId}/voice`, { lines: [run.greeting] })).status).toBe(200);
    expect(eleven.calls).toHaveLength(1);
    expect(readdirSync(cacheDir).filter((f) => f.endsWith(".mp3"))).toHaveLength(1);
  });

  it("stops at the daily character cap, and a failed call doesn't use it up", async () => {
    const tight = setup({ dailyChars: 10 });
    const run = await newRun(tight.app);
    expect((await post(tight.app, `/api/runs/${run.runId}/voice`, { lines: [run.greeting] })).status).toBe(429);
    expect(tight.eleven.calls).toHaveLength(0);

    const failing = setup({ status: 401 });
    const run2 = await newRun(failing.app);
    expect((await post(failing.app, `/api/runs/${run2.runId}/voice`, { lines: [run2.greeting] })).status).toBe(429);
  });

  it("leaves out stage directions", () => {
    expect(speakable("*sips tea*  Oh, Biscuit!   *chuckles*")).toBe("Oh, Biscuit!");
  });

  it("is off unless both a key and a voice are set, and only reads the key from .env", () => {
    expect(readConfig({}, { ELEVENLABS_API_KEY: "k" }).voice).toBeUndefined();
    expect(readConfig({}, { ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "v" }).voice).toMatchObject({ apiKey: "k", voiceId: "v", model: "eleven_flash_v2_5" });
    // A key some other tool exported is ignored, like the Anthropic key.
    expect(readConfig({ ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "v" }, {}).voice).toBeUndefined();
    expect(readConfig({ ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "v", GRANDMA_VOICE: "elevenlabs" }, {}).voice?.apiKey).toBe("k");
    expect(readConfig({}, { ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "v", GRANDMA_VOICE: "browser" }).voice).toBeUndefined();
  });
});
