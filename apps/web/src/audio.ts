/**
 * Sounds made in code with WebAudio: no audio files, so nothing to license or download.
 * - babble(): Grandma's voice as soft syllable blips (pitch by mood), instead of synthetic speech.
 *   Bad TTS hurt other LLM-NPC games; blips carry tone without the uncanny valley.
 * - chime(): small UI cues (notebook entry, router success/failure).
 * Everything also has an on-screen equivalent (text), so muting (M) loses no information.
 */
const MUTE_KEY = "gwp-muted";
let ctx: AudioContext | null = null;
let muted = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";

function audio(): AudioContext | null {
  if (muted || typeof AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  return muted;
}

function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "triangle", slideTo?: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
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
    tone(c, at, f, 0.06, 0.035, "triangle");
    at += v.gap + rand() * 0.02;
    if (/[.!?]/.test(text) && i > 0 && i % 9 === 0) at += 0.12; // a breath between sentences
  }
  if (mood === "confused") tone(c, at, v.pitch, 0.12, 0.03, "triangle", v.pitch * 1.4); // rising "hm?"
}

export function chime(kind: "note" | "success" | "fail") {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  if (kind === "note") {
    tone(c, t, 880, 0.12, 0.03, "sine");
    tone(c, t + 0.07, 1320, 0.16, 0.025, "sine");
  } else if (kind === "success") {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.09, f, 0.25, 0.04, "sine"));
  } else {
    tone(c, t, 220, 0.18, 0.05, "square");
    tone(c, t + 0.2, 165, 0.25, 0.05, "square");
  }
}
