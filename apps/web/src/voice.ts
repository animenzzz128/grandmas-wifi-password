/**
 * Voice conversation with the browser's own speech APIs (no keys, no extra service):
 * - speak(): Grandma reads her lines aloud (speechSynthesis), a little slower and lower, tuned by mood.
 * - listen(): the player asks by voice (SpeechRecognition). In Chrome the audio goes to Google's speech
 *   service; Settings says so. Only starts on a key press or click, never by itself.
 * Text is always on screen too, so nothing depends on hearing or speaking.
 */
import { useGame } from "./store.ts";
import { isMuted } from "./audio.ts";

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

export function speak(text: string, mood = "happy") {
  if (!synth || isMuted()) return;
  synth.cancel(); // never talk over herself
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  const p = PROSODY[mood] ?? PROSODY.happy!;
  u.rate = p.rate;
  u.pitch = p.pitch;
  u.onstart = () => useGame.setState({ grandmaSpeaking: true });
  u.onend = u.onerror = () => useGame.setState({ grandmaSpeaking: false });
  synth.speak(u);
}

export function stopSpeaking() {
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
