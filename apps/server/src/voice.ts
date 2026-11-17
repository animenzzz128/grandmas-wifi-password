/**
 * Grandma's spoken voice, from ElevenLabs text-to-speech (iteration 53). The browser's own speech voices
 * sounded like an assistant; ElevenLabs can speak in a designed elderly voice (tools/design-grandma-voice.mjs).
 *
 * Guards, because every character costs money:
 * - It only speaks what Grandma actually said in that visit (or one of her canned reactions); app.ts checks.
 * - Each line is synthesised once and cached on disk (var/voice), so a repeated line is free.
 * - A daily character cap (UTC day). Past it, or without a key, the client falls back to the browser voice.
 * Only Grandma's own lines go to ElevenLabs, never anything the player typed.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface VoiceOptions {
  apiKey: string;
  voiceId: string;
  /** ElevenLabs model, e.g. eleven_flash_v2_5 (fast and half price) or eleven_multilingual_v2. */
  model: string;
  /** Characters a UTC day may synthesise (cached lines don't count). */
  dailyChars: number;
  cacheDir: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

/** How she says it, by mood: slower and steadier when sleepy or wistful, livelier when teasing. */
export const VOICE_SETTINGS: Record<string, { stability: number; style: number; speed: number }> = {
  happy: { stability: 0.45, style: 0.3, speed: 0.92 },
  teasing: { stability: 0.35, style: 0.45, speed: 0.95 },
  nostalgic: { stability: 0.55, style: 0.25, speed: 0.86 },
  confused: { stability: 0.4, style: 0.3, speed: 0.88 },
  suspicious: { stability: 0.5, style: 0.35, speed: 0.88 },
  worried: { stability: 0.45, style: 0.3, speed: 0.9 },
  sleepy: { stability: 0.7, style: 0.1, speed: 0.8 },
};

export class VoiceUnavailable extends Error {}

/** Text as it should be read: stage directions like *sips tea* dropped, spaces tidied. */
export function speakable(text: string): string {
  return text
    .replace(/\*[^*]{0,80}\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class GrandmaVoice {
  readonly provider = "elevenlabs";
  private day = "";
  private used = 0;

  constructor(private opts: VoiceOptions) {
    mkdirSync(opts.cacheDir, { recursive: true });
  }

  /** Characters synthesised today (UTC). */
  get usedToday(): number {
    this.rollDay();
    return this.used;
  }

  private rollDay() {
    const day = (this.opts.now?.() ?? new Date()).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.used = 0;
    }
  }

  private cacheKey(text: string, mood: string): string {
    const o = this.opts;
    return createHash("sha256").update(`${o.voiceId}|${o.model}|${mood}|${text}`).digest("hex").slice(0, 32);
  }

  /** MP3 audio of Grandma saying `text` in `mood`. Throws VoiceUnavailable when the day's cap is reached. */
  async say(rawText: string, mood: string): Promise<Uint8Array> {
    const text = speakable(rawText);
    if (!text) throw new VoiceUnavailable("nothing to say");
    const settings = VOICE_SETTINGS[mood] ?? VOICE_SETTINGS.happy!;
    const file = join(this.opts.cacheDir, `${this.cacheKey(text, mood in VOICE_SETTINGS ? mood : "happy")}.mp3`);
    if (existsSync(file)) return readFileSync(file);

    this.rollDay();
    if (this.used + text.length > this.opts.dailyChars) throw new VoiceUnavailable("daily voice budget used");
    this.used += text.length;

    const url = `${this.opts.baseUrl ?? "https://api.elevenlabs.io"}/v1/text-to-speech/${encodeURIComponent(this.opts.voiceId)}?output_format=mp3_44100_64`;
    const res = await (this.opts.fetch ?? fetch)(url, {
      method: "POST",
      headers: { "xi-api-key": this.opts.apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: this.opts.model,
        voice_settings: { stability: settings.stability, similarity_boost: 0.8, style: settings.style, speed: settings.speed, use_speaker_boost: true },
      }),
    });
    if (!res.ok) {
      this.used -= text.length; // nothing was spoken
      const detail = await res.text().catch(() => "");
      console.error(`[voice] ElevenLabs ${res.status}: ${detail.slice(0, 200)}`);
      throw new VoiceUnavailable(`ElevenLabs ${res.status}`);
    }
    const audio = new Uint8Array(await res.arrayBuffer());
    writeFileSync(file, audio);
    return audio;
  }
}
