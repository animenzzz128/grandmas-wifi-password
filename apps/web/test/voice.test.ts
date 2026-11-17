import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeUtterance {
  voice: unknown = null;
  rate = 1;
  pitch = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function fakeSynth() {
  return {
    spoken: [] as FakeUtterance[],
    cancelled: 0,
    speak(u: FakeUtterance) {
      this.spoken.push(u);
    },
    cancel() {
      this.cancelled++;
    },
    getVoices: () => [
      { name: "Microsoft David - English (United States)", lang: "en-US" },
      { name: "Microsoft Zira - English (United States)", lang: "en-US" },
    ],
  };
}

describe("Grandma's spoken voice", () => {
  let synth: ReturnType<typeof fakeSynth>;
  beforeEach(() => {
    vi.resetModules();
    synth = fakeSynth();
    vi.stubGlobal("window", { speechSynthesis: synth });
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads a line aloud with a warm voice, slower when nostalgic, and never talks over herself", async () => {
    const { speak } = await import("../src/voice.ts");
    speak(["Oh, the summer of 1968..."], "nostalgic");
    speak(["Now, what was I saying?"], "happy");
    expect(synth.cancelled).toBe(2);
    expect(synth.spoken).toHaveLength(2);
    const [nostalgic, happy] = synth.spoken;
    expect((nostalgic!.voice as { name: string }).name).toMatch(/Zira/);
    expect(nostalgic!.rate).toBeLessThan(happy!.rate);
  });

  it("drives the talking flag from the speech events", async () => {
    const { speak, stopSpeaking } = await import("../src/voice.ts");
    const { useGame } = await import("../src/store.ts");
    speak(["Hello, dear."], "happy");
    synth.spoken[0]!.onstart!();
    expect(useGame.getState().grandmaSpeaking).toBe(true);
    synth.spoken[0]!.onend!();
    expect(useGame.getState().grandmaSpeaking).toBe(false);
    speak(["Again."], "happy");
    synth.spoken[1]!.onstart!();
    stopSpeaking();
    expect(useGame.getState().grandmaSpeaking).toBe(false);
  });

  it("can't listen without a speech recognizer and says so", async () => {
    const { canListen, listen } = await import("../src/voice.ts");
    expect(canListen()).toBe(false);
    const onError = vi.fn();
    listen({ onInterim: () => {}, onFinal: () => {}, onError });
    expect(onError).toHaveBeenCalledWith("unsupported");
  });
});
