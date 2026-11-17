/**
 * Voice conversation:
 * - speak(): Grandma reads her lines aloud. When the server has her ElevenLabs voice (iteration 53), that's
 *   what plays; otherwise, or if it fails, the browser's own voice (speechSynthesis), slower and lower by mood.
 * - listen(): the player asks by voice (SpeechRecognition). In Chrome the audio goes to Google's speech
 *   service; Settings says so. Only starts on a key press or click, never by itself.
 * Text is always on screen too, so nothing depends on hearing or speaking.
 */
import { useGame } from "./store.ts";
import { isMuted, playVoiceClip } from "./audio.ts";
import { api } from "./api.ts";
import { useSettings } from "./settings.ts";

const synth: SpeechSynthesis | undefined = typeof window !== "undefined" ? window.speechSynthesis : undefined;

export const canSpeak = (): boolean => Boolean(synth);

/** Prefer a warm English voice; fall back to whatever English voice exists. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = synth?.getVoices() ?? [];
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const prefer = [/female/i, /zira/i, /susan/i, /samantha/i, /karen/i, /moira/i, /hazel/i, /libby/i, /aria/i, /jenny/i];
  for (const re of prefer) {
    const v = english.find((x) => re.test(x.name));
    if (v) return v;
  }
  return english[0] ?? voices[0];
}

const PROSODY: Record<string, { rate: number; pitch: number }> = {
  happy: { rate: 0.95, pitch: 1.05 },
  teasing: { rate: 0.98, pitch: 1.08 },
  nostalgic: { rate: 0.86, pitch: 0.95 },
  confused: { rate: 0.9, pitch: 1.0 },
  suspicious: { rate: 0.88, pitch: 0.9 },
  worried: { rate: 0.88, pitch: 0.95 },
  sleepy: { rate: 0.78, pitch: 0.85 },
};

/** The clip playing now (ElevenLabs), and which speak() call is current, so a late answer can't talk over a newer one. */
let playing: { stop(): void } | null = null;
let turn = 0;

/** Grandma says her new lines (several lines can arrive at once: a reply, a nap, a nudge). */
export function speak(lines: string[], mood = "happy") {
  if (isMuted() || !lines.length) return;
  stopSpeaking();
  const mine = ++turn;
  const { health, run } = useGame.getState();
  if (health?.voice === "elevenlabs" && run) {
    useGame.setState({ grandmaSpeaking: true }); // she's drawing breath while the audio arrives
    void api.voice(run.runId, lines, mood).then(async (mp3) => {
      if (mine !== turn) return;
      const clip = mp3 ? await playVoiceClip(mp3).catch(() => null) : null;
      if (mine !== turn) return clip?.stop();
      if (!clip) return speakWithBrowser(lines.join(" "), mood); // no key, over budget, offline: the old voice
      playing = clip;
      await clip.ended;
      if (mine === turn) {
        playing = null;
        useGame.setState({ grandmaSpeaking: false });
      }
    });
    return;
  }
  speakWithBrowser(lines.join(" "), mood);
}

function speakWithBrowser(text: string, mood: string) {
  if (!synth) return useGame.setState({ grandmaSpeaking: false });
  // speak() has already stopped anything she was saying (stopSpeaking), so she never talks over herself.
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  const p = PROSODY[mood] ?? PROSODY.happy!;
  u.rate = p.rate;
  u.pitch = p.pitch;
  u.volume = Math.min(1, Math.max(0, useSettings.getState().voiceVolume));
  u.onstart = () => useGame.setState({ grandmaSpeaking: true });
  u.onend = u.onerror = () => useGame.setState({ grandmaSpeaking: false });
  synth.speak(u);
}

export function stopSpeaking() {
  turn++;
  playing?.stop();
  playing = null;
  synth?.cancel();
  useGame.setState({ grandmaSpeaking: false });
}

// ---------- listening ----------

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;
const Ctor: RecognitionCtor | undefined =
  typeof window !== "undefined" ? ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition) : undefined;

export const canListen = (): boolean => Boolean(Ctor);

let active: Recognition | null = null;

/**
 * Listen for one question. Interim text goes to onInterim (shown in the chat box); the final text to
 * onFinal (sent to Grandma). Calling it again while listening stops it.
 */
export function listen(handlers: { onInterim(text: string): void; onFinal(text: string, confidence: number): void; onError(code: string): void }) {
  if (active) {
    active.stop();
    return;
  }
  if (!Ctor) return handlers.onError("unsupported");
  stopSpeaking(); // don't record Grandma's own voice
  const r = new Ctor();
  r.lang = "en-US";
  r.interimResults = true;
  r.continuous = false;
  let finalText = "";
  let confidence = 1;
  r.onresult = (e) => {
    let interim = "";
    finalText = "";
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i]!;
      if (res.isFinal) {
        finalText += res[0]!.transcript;
        confidence = Math.min(confidence, res[0]!.confidence); // the least sure part decides
      } else interim += res[0]!.transcript;
    }
    handlers.onInterim((finalText + interim).trim());
  };
  r.onerror = (e) => handlers.onError(e.error);
  r.onend = () => {
    active = null;
    useGame.setState({ listening: false });
    if (finalText.trim()) handlers.onFinal(finalText.trim(), confidence);
  };
  active = r;
  useGame.setState({ listening: true });
  r.start();
}
