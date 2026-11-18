/**
 * "Rosie's Waltz", the room music (iteration 56). Original, written note by note below and played by WebAudio
 * synths, so there's no audio file to license. It replaced "Kolaczki Rag" (iteration 41), whose busy oom-pah
 * melody in bare oscillators sounded like a ringtone.
 *
 * Written for a puzzle game, after how puzzle scores are described:
 * - Background, not foreground: slow (a waltz at 88 beats a minute), quiet, a melody only half the time, so
 *   it never competes with reading and thinking (Ashi: Lake of Light; Layton's puzzle cues).
 * - Whimsy and a little mystery: a curious D-minor phrase answered by a warm F-major one, on felt piano,
 *   music box and a soft accordion pad in musette tuning, the European-parlour colour of Professor Layton.
 * - A loop you don't notice repeating: 32 bars (about a minute) in four passes, each with a different lead:
 *   piano, music box, none (only "thinking" arpeggios), then a thinned-out piano.
 * - A room around it: a generated reverb, gentle low-pass, no sharp attacks.
 *
 * Pure score data plus synths that draw on any AudioContext, so it can also be rendered offline (a preview file).
 */

/** Beats a minute (three to a bar). */
export const TEMPO = 88;
export const BEAT = 60 / TEMPO;
export const BAR = 3 * BEAT;

/** A note: MIDI pitch, start and length in eighth notes within the bar (six eighths to a bar). */
export type Note = [midi: number, start: number, length: number];

interface Bar {
  /** Bass root (MIDI). */
  bass: number;
  /** Chord tones for the pad and the plucks (MIDI). */
  chord: number[];
  melody: Note[];
}

// Phrase A, D minor, curious: a line that climbs and asks, over a descending bass (D, C#, C, Bb).
const A: Bar[] = [
  { bass: 38, chord: [62, 65, 69], melody: [[69, 0, 2], [74, 2, 1], [76, 3, 1], [77, 4, 2]] }, // Dm
  { bass: 37, chord: [61, 65, 69], melody: [[76, 0, 3], [74, 3, 1], [73, 4, 2]] }, // Dm/C#
  { bass: 36, chord: [60, 65, 69], melody: [[74, 0, 2], [77, 2, 1], [81, 3, 1], [79, 4, 2]] }, // Dm/C
  { bass: 34, chord: [62, 65, 69], melody: [[81, 0, 4], [77, 4, 2]] }, // Bbmaj7
  { bass: 43, chord: [62, 64, 70], melody: [[79, 0, 2], [82, 2, 1], [81, 3, 1], [79, 4, 1], [76, 5, 1]] }, // Gm6
  { bass: 45, chord: [61, 64, 67], melody: [[77, 0, 2], [76, 2, 2], [73, 4, 2]] }, // A7
  { bass: 38, chord: [62, 65, 69], melody: [[74, 0, 3], [76, 3, 1], [77, 4, 1], [81, 5, 1]] }, // Dm
  { bass: 45, chord: [61, 64, 67], melody: [[79, 0, 2], [76, 2, 2]] }, // A7
];

// Phrase B, F major, warm: the answer, like a story she's fond of.
const B: Bar[] = [
  { bass: 41, chord: [64, 69, 72], melody: [[81, 0, 2], [84, 2, 1], [81, 3, 1], [79, 4, 2]] }, // Fmaj7
  { bass: 45, chord: [64, 67, 72], melody: [[76, 0, 3], [79, 3, 1], [81, 4, 2]] }, // Am7
  { bass: 46, chord: [62, 65, 69], melody: [[86, 0, 2], [84, 2, 1], [81, 3, 1], [77, 4, 2]] }, // Bbmaj7
  { bass: 48, chord: [64, 67, 70], melody: [[79, 0, 4], [76, 4, 2]] }, // C7
  { bass: 41, chord: [64, 69, 72], melody: [[77, 0, 2], [81, 2, 1], [84, 3, 1], [88, 4, 2]] }, // Fmaj7
  { bass: 38, chord: [66, 69, 72], melody: [[86, 0, 2], [84, 2, 1], [81, 3, 1], [78, 4, 2]] }, // D7
  { bass: 43, chord: [65, 70, 74], melody: [[79, 0, 2], [82, 2, 1], [86, 3, 1], [84, 4, 2]] }, // Gm7
  { bass: 48, chord: [64, 67, 70], melody: [[82, 0, 2], [79, 2, 2], [76, 4, 2]] }, // C7
];

/** Which instrument leads each pass of 16 bars (A then B). */
export type Lead = "piano" | "musicbox" | "none" | "sparse";
export const PASSES: Lead[] = ["piano", "musicbox", "none", "sparse"];
export const SCORE: Bar[] = [...A, ...B];
/** Bars in one full loop (every pass once). */
export const LOOP_BARS = SCORE.length * PASSES.length;

/** What plays in bar `n` of the loop (counting from 0, wrapping). */
export function barAt(n: number): Bar & { lead: Lead; pad: boolean; arpeggio: boolean } {
  const i = ((n % LOOP_BARS) + LOOP_BARS) % LOOP_BARS;
  const lead = PASSES[Math.floor(i / SCORE.length)]!;
  const bar = SCORE[i % SCORE.length]!;
  // The thinned pass keeps only the first note of each bar: the tune is remembered, not played.
  const melody = lead === "none" ? [] : lead === "sparse" ? bar.melody.slice(0, 1) : bar.melody;
  // The accordion pad colours the warm phrase and the melody-less pass.
  const inB = i % SCORE.length >= A.length;
  return { ...bar, melody, lead, pad: inB || lead === "none", arpeggio: lead === "none" };
}

export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// ---- Synths ------------------------------------------------------------------------------------------------

type Ctx = BaseAudioContext;

/** One envelope-shaped voice: oscillators summed into a gain, through a low-pass. */
function voice(c: Ctx, out: AudioNode, at: number, parts: { type: OscillatorType; freq: number; gain: number; detune?: number }[], env: { attack: number; decay: number; peak: number }, cutoff: number) {
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  lp.Q.value = 0.5;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(env.peak, at + env.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + env.attack + env.decay);
  g.connect(lp).connect(out);
  const end = at + env.attack + env.decay + 0.05;
  for (const p of parts) {
    const o = c.createOscillator();
    o.type = p.type;
    o.frequency.value = p.freq;
    if (p.detune) o.detune.value = p.detune;
    const pg = c.createGain();
    pg.gain.value = p.gain;
    o.connect(pg).connect(g);
    o.start(at);
    o.stop(end);
  }
}

/** Felt piano: soft hammer, a few partials, a long gentle decay. */
function piano(c: Ctx, out: AudioNode, at: number, midi: number, seconds: number, peak: number) {
  const f = hz(midi);
  voice(c, out, at, [
    { type: "sine", freq: f, gain: 1 },
    { type: "sine", freq: f, gain: 0.5, detune: 4 },
    { type: "sine", freq: f * 2, gain: 0.32 },
    { type: "triangle", freq: f * 3, gain: 0.06 },
  ], { attack: 0.012, decay: Math.max(1.1, seconds * 1.8), peak }, 2600);
}

/** Music box: a bright tine with a slightly out-of-tune overtone, short and glassy. */
function musicBox(c: Ctx, out: AudioNode, at: number, midi: number, peak: number) {
  const f = hz(midi + 12);
  voice(c, out, at, [
    { type: "sine", freq: f, gain: 1 },
    { type: "sine", freq: f * 4.2, gain: 0.08 },
  ], { attack: 0.004, decay: 1.3, peak }, 6000);
}

/** Plucked bass or chord (a soft pizzicato). */
function pluck(c: Ctx, out: AudioNode, at: number, midi: number, peak: number, decay = 0.6) {
  const f = hz(midi);
  voice(c, out, at, [
    { type: "triangle", freq: f, gain: 1 },
    { type: "sine", freq: f * 2, gain: 0.25 },
  ], { attack: 0.008, decay, peak }, 1200);
}

/** Accordion pad: two reeds per note tuned a few cents apart (musette), breathing in and out over the bar. */
function accordion(c: Ctx, out: AudioNode, at: number, chord: number[], seconds: number, peak: number) {
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1100;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + seconds * 0.35);
  g.gain.linearRampToValueAtTime(peak * 0.7, at + seconds * 0.8);
  g.gain.linearRampToValueAtTime(0, at + seconds + 0.25);
  g.connect(lp).connect(out);
  for (const n of chord)
    for (const cents of [-5, 5]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = hz(n);
      o.detune.value = cents;
      o.connect(g);
      o.start(at);
      o.stop(at + seconds + 0.3);
    }
}

/** A small room: a generated impulse response (decaying stereo noise). */
function reverb(c: Ctx, seconds = 2.4): ConvolverNode {
  const rate = c.sampleRate;
  const len = Math.floor(rate * seconds);
  const ir = c.createBuffer(2, len, rate);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = rnd() * (1 - i / len) ** 3;
  }
  const conv = c.createConvolver();
  conv.buffer = ir;
  return conv;
}

/** The music's own mix: everything into a low-pass, then dry plus a little room, into `dest`. */
export function musicBus(c: Ctx, dest: AudioNode): AudioNode {
  const input = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6500;
  const dry = c.createGain();
  dry.gain.value = 0.8;
  const wet = c.createGain();
  wet.gain.value = 0.32;
  input.connect(lp);
  lp.connect(dry).connect(dest);
  lp.connect(reverb(c)).connect(wet).connect(dest);
  return input;
}

/** Schedule bar `n` of the loop to start at `at` (seconds on the context's clock). */
export function playBar(c: Ctx, out: AudioNode, n: number, at: number) {
  const bar = barAt(n);
  const e = BEAT / 2;
  // Waltz: bass on one, two light chord plucks on two and three.
  pluck(c, out, at, bar.bass, 0.11, 0.9);
  for (const beat of [1, 2]) for (const note of bar.chord) pluck(c, out, at + beat * BEAT, note, 0.018, 0.35);
  if (bar.pad) accordion(c, out, at, bar.chord, BAR, 0.012);
  if (bar.arpeggio) [0, 2, 4].forEach((s, i) => musicBox(c, out, at + s * e, bar.chord[i % bar.chord.length]!, 0.02));
  for (const [midi, start, len] of bar.melody) {
    if (bar.lead === "musicbox") musicBox(c, out, at + start * e, midi - 12, 0.05);
    else piano(c, out, at + start * e, midi, len * e, bar.lead === "sparse" ? 0.045 : 0.06);
  }
}
