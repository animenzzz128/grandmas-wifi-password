/**
 * Sounds made in code with WebAudio: no audio files, so nothing to license or download.
 * - babble(): Grandma's voice as soft syllable blips (pitch by mood), instead of synthetic speech.
 *   Bad TTS hurt other LLM-NPC games; blips carry tone without the uncanny valley.
 * - chime(): small UI cues (notebook entry, router success/failure).
 * - snore(): one soft snore while she dozes (GDD §8.3).
 * - clock: a quiet ticking clock for the room (GDD §8.2 ambience); a setting turns it off.
 * - music: "Rosie's Waltz", an original minute-long loop for the room, written note by note in music.ts.
 * Three channels (effects, voice, music) with their own volume in Settings (Game Accessibility Guidelines).
 * Everything also has an on-screen equivalent (text), so muting (M) loses no information.
 */
import { storage } from "./storage.ts";
import { useSettings } from "./settings.ts";
import { BAR, musicBus, playBar } from "./music.ts";

const MUTE_KEY = "gwp-muted";
let ctx: AudioContext | null = null;
let muted = storage.getItem(MUTE_KEY) === "1";

function audio(): AudioContext | null {
  if (muted || typeof AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Channel = "sfx" | "voice" | "music";
const channels: Partial<Record<Channel, GainNode>> = {};
const level = (ch: Channel) => {
  const s = useSettings.getState();
  return ch === "music" ? s.musicVolume : ch === "voice" ? s.voiceVolume : s.sfxVolume;
};
/** Each channel is a gain node in front of the speakers, following its volume setting live. */
function channel(c: AudioContext, ch: Channel): AudioNode {
  let g = channels[ch];
  if (!g) {
    g = c.createGain();
    g.gain.value = level(ch);
    g.connect(c.destination);
    channels[ch] = g;
  }
  return g;
}
useSettings.subscribe(() => {
  for (const ch of ["sfx", "voice", "music"] as const) channels[ch]?.gain.setTargetAtTime(level(ch), ctx?.currentTime ?? 0, 0.05);
});

/**
 * Plays recorded speech (Grandma's ElevenLabs voice) on the voice channel, so its volume setting applies.
 * Resolves when it ends or is stopped; returns a stop function right away. Null if sound is off.
 */
export async function playVoiceClip(mp3: ArrayBuffer): Promise<{ stop(): void; ended: Promise<void> } | null> {
  const c = audio();
  if (!c) return null;
  const buffer = await c.decodeAudioData(mp3);
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.connect(channel(c, "voice"));
  const ended = new Promise<void>((resolve) => (src.onended = () => resolve()));
  src.start();
  return { stop: () => src.stop(), ended };
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  storage.setItem(MUTE_KEY, muted ? "1" : "0");
  return muted;
}

function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "triangle", slideTo?: number, out: Channel = "sfx") {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(channel(c, out));
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Base pitch (Hz) and pace by mood: brighter when happy, lower and slower when sleepy or wary. */
const VOICE: Record<string, { pitch: number; gap: number; lilt: number }> = {
  happy: { pitch: 330, gap: 0.07, lilt: 0.25 },
  teasing: { pitch: 345, gap: 0.068, lilt: 0.3 },
  nostalgic: { pitch: 285, gap: 0.085, lilt: 0.12 },
  confused: { pitch: 300, gap: 0.08, lilt: 0.35 },
  suspicious: { pitch: 245, gap: 0.085, lilt: 0.1 },
  worried: { pitch: 265, gap: 0.08, lilt: 0.15 },
  sleepy: { pitch: 210, gap: 0.11, lilt: 0.08 },
};

/** Grandma "says" a line: one blip per syllable-ish, capped so long replies don't drone on. */
export function babble(text: string, mood = "happy") {
  const c = audio();
  if (!c) return;
  const v = VOICE[mood] ?? VOICE.happy!;
  const words = text.split(/\s+/).filter(Boolean).length;
  const count = Math.min(26, Math.max(3, Math.round(words * 1.2)));
  let seed = text.length;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let at = c.currentTime + 0.05;
  for (let i = 0; i < count; i++) {
    const f = v.pitch * (1 + (rand() - 0.5) * v.lilt);
    tone(c, at, f, 0.06, 0.035, "triangle", undefined, "voice");
    at += v.gap + rand() * 0.02;
    if (/[.!?]/.test(text) && i > 0 && i % 9 === 0) at += 0.12; // a breath between sentences
  }
  if (mood === "confused") tone(c, at, v.pitch, 0.12, 0.03, "triangle", v.pitch * 1.4, "voice"); // rising "hm?"
}

let noise: AudioBuffer | null = null;
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = noise.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < data.length; i++) data[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return noise;
}

/** Filtered noise with a gain envelope (attack, hold, release in seconds). */
function hiss(c: AudioContext, at: number, filter: { type: BiquadFilterType; freq: number; q?: number }, env: [number, number, number], gain: number) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter.type;
  f.frequency.value = filter.freq;
  f.Q.value = filter.q ?? 1;
  const g = c.createGain();
  const [a, h, r] = env;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + a);
  g.gain.setValueAtTime(gain, at + a + h);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + h + r);
  src.connect(f).connect(g).connect(channel(c, "sfx"));
  src.start(at, Math.random() * 0.5);
  src.stop(at + a + h + r + 0.05);
}

/** One snore: a slow, low breath in with a rumble, then a softer breath out. */
export function snore() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  hiss(c, t, { type: "bandpass", freq: 260, q: 3 }, [0.9, 0.3, 0.5], 0.05);
  tone(c, t + 0.35, 72, 0.9, 0.03, "sawtooth", 64);
  hiss(c, t + 1.9, { type: "lowpass", freq: 700 }, [0.4, 0.2, 0.9], 0.02);
}

let clockTimer: ReturnType<typeof setInterval> | null = null;
/** A quiet tick-tock, scheduled a little ahead so it stays even. Stops by itself while muted. */
export function startClock() {
  if (clockTimer) return;
  let next = 0;
  let tock = false;
  clockTimer = setInterval(() => {
    const c = audio();
    if (!c) return;
    if (next < c.currentTime) next = c.currentTime + 0.05;
    while (next < c.currentTime + 0.3) {
      hiss(c, next, { type: "bandpass", freq: tock ? 2600 : 3400, q: 8 }, [0.002, 0.004, 0.03], 0.02);
      tock = !tock;
      next += 1;
    }
  }, 150);
}

export function stopClock() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = null;
  stopWind();
}

/**
 * Wind past the snowy window (iteration 56, review F13): low filtered noise whose level and colour drift
 * slowly, very quiet, under the clock. Part of "room sound", like the clock.
 */
let wind: { src: AudioBufferSourceNode; lfo: OscillatorNode } | null = null;
export function startWind() {
  const c = audio();
  if (!c || wind) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 380;
  f.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = 0.012;
  // A gust every ~9 seconds: the LFO swells the level and opens the filter a little.
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.11;
  const depth = c.createGain();
  depth.gain.value = 0.008;
  const sweep = c.createGain();
  sweep.gain.value = 160;
  lfo.connect(depth).connect(g.gain);
  lfo.connect(sweep).connect(f.frequency);
  src.connect(f).connect(g).connect(channel(c, "sfx"));
  src.start();
  lfo.start();
  wind = { src, lfo };
}
export function stopWind() {
  wind?.src.stop();
  wind?.lfo.stop();
  wind = null;
}

/** A soft air movement when the camera moves to another view (the Godot edition's "whoosh"). */
export function whoosh() {
  const c = audio();
  if (!c) return;
  hiss(c, c.currentTime + 0.01, { type: "bandpass", freq: 900, q: 0.8 }, [0.35, 0.1, 0.5], 0.012);
}

/** A card turns up: a light paper flick. */
export function cardFlick() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.01;
  hiss(c, t, { type: "highpass", freq: 3000 }, [0.005, 0.02, 0.06], 0.03);
  tone(c, t + 0.02, 1320, 0.08, 0.02, "sine", 1760);
}

/** The fridge door: the seal unsticking and the hum (open), or a soft thump (shut). */
export function fridgeDoor(open: boolean) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  if (open) {
    hiss(c, t, { type: "bandpass", freq: 1800, q: 2 }, [0.01, 0.04, 0.12], 0.03); // the seal
    tone(c, t + 0.05, 60, 0.9, 0.012, "sine"); // the motor hum
  } else {
    tone(c, t, 95, 0.12, 0.05, "sine", 70);
    hiss(c, t, { type: "lowpass", freq: 400 }, [0.005, 0.02, 0.1], 0.04);
  }
}

export function chime(kind: "note" | "pin" | "success" | "fail") {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  if (kind === "pin") {
    tone(c, t, 1175, 0.08, 0.025, "sine"); // a light "tack"
    tone(c, t + 0.05, 1568, 0.12, 0.02, "sine");
  } else if (kind === "note") {
    tone(c, t, 880, 0.12, 0.03, "sine");
    tone(c, t + 0.07, 1320, 0.16, 0.025, "sine");
  } else if (kind === "success") {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.09, f, 0.25, 0.04, "sine"));
  } else {
    tone(c, t, 220, 0.18, 0.05, "square");
    tone(c, t + 0.2, 165, 0.25, 0.05, "square");
  }
}

// ---- Music: "Rosie's Waltz" (iteration 56; the score and synths are in music.ts) -------------------------
let musicTimer: ReturnType<typeof setInterval> | null = null;
let bus: { ctx: AudioContext; node: AudioNode; duck: GainNode } | null = null;
let ducked = false;
/** Music steps back (about −6 dB) while Grandma speaks, so her words stay clear (iteration 56, review F13). */
export function duckMusic(on: boolean) {
  ducked = on;
  if (bus) bus.duck.gain.setTargetAtTime(on ? 0.5 : 1, bus.ctx.currentTime, on ? 0.08 : 0.4);
}
export function startMusic() {
  if (musicTimer) return;
  let bar = 0;
  let barStart = 0;
  musicTimer = setInterval(() => {
    const c = audio();
    if (!c) return;
    if (bus?.ctx !== c) {
      const duck = c.createGain();
      duck.gain.value = ducked ? 0.5 : 1;
      duck.connect(channel(c, "music"));
      bus = { ctx: c, node: musicBus(c, duck), duck };
    }
    // A fresh start (or after the tab slept): begin a little ahead, from the top of the loop.
    if (barStart < c.currentTime) {
      barStart = c.currentTime + 0.15;
      bar = 0;
    }
    while (barStart < c.currentTime + 0.8) {
      playBar(c, bus.node, bar, barStart);
      barStart += BAR;
      bar++;
    }
  }, 250);
}

/** Dev only: render `seconds` of the music offline and return it as a WAV file (to listen without playing). */
export async function renderMusicWav(seconds = 60, rate = 44100): Promise<ArrayBuffer> {
  const c = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const out = musicBus(c, c.destination);
  for (let n = 0, at = 0.05; at < seconds; n++, at += BAR) playBar(c, out, n, at);
  const buf = await c.startRendering();
  return wav(buf);
}

function wav(buf: AudioBuffer): ArrayBuffer {
  const ch = buf.numberOfChannels, len = buf.length, out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((x, i) => out.setUint8(o + i, x.charCodeAt(0)));
  str(0, "RIFF"); out.setUint32(4, 36 + len * ch * 2, true); str(8, "WAVEfmt "); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  str(36, "data"); out.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  for (let i = 0, o = 44; i < len; i++) for (let j = 0; j < ch; j++, o += 2) out.setInt16(o, Math.max(-1, Math.min(1, data[j]![i]!)) * 0x7fff, true);
  return out.buffer;
}
if (import.meta.env?.DEV && typeof window !== "undefined") Object.assign(window, { __renderMusicWav: renderMusicWav });

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
