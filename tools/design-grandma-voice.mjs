/**
 * Design Grandma Rosie's spoken voice with ElevenLabs Voice Design, then save the one you like (iteration 53).
 * Creating a voice through the API needs a paid ElevenLabs plan (checked 2026-11-17: the free plan gets 403
 * "feature_not_available"). On the free plan, design her on the website instead (Voices > Voice Design) with the
 * DESCRIPTION and SAMPLE below, and copy the saved voice's ID; speaking with it through the API works on free.
 * Uses ELEVENLABS_API_KEY from the repo's .env, whose key needs the Voice Generation and Voices (write)
 * permissions. Each design run uses some of your ElevenLabs credits.
 *
 *   node tools/design-grandma-voice.mjs                  three previews -> var/voice-design/*.mp3; listen to them
 *   node tools/design-grandma-voice.mjs --description "..."   same, with your own description
 *   node tools/design-grandma-voice.mjs --save <generated_voice_id>   keep one; prints the line for .env
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env");
const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const key = env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("Put ELEVENLABS_API_KEY=... in .env first (see .env.example).");
  process.exit(1);
}

const DESCRIPTION =
  "An elderly American woman in her late seventies from Buffalo, New York, with a faint Polish-American family accent. " +
  "Warm, affectionate and a little teasing. A slightly thin, gently wavering older voice with soft breathiness and an unhurried pace, " +
  "like a real grandmother telling stories over a cup of tea in her living room. Natural and homely, not a polished narrator.";

const SAMPLE =
  "Oh, sweetheart, you made it! Sit down, sit down. Did you want a cookie? I counted them, so don't think I won't notice. " +
  "Now where was I... oh yes, your grandpa. He was always losing his reading glasses, and they were right on top of his head the whole time. " +
  "Goodness, I do go on. Ask me anything you like, dear.";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function call(path, body) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`ElevenLabs ${res.status}: ${text.slice(0, 400)}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

const saveId = flag("--save");
if (saveId) {
  const saved = await call("/v1/text-to-voice", {
    voice_name: "Grandma Rosie",
    voice_description: flag("--description") ?? DESCRIPTION,
    generated_voice_id: saveId,
  });
  console.log(`Saved. Add this line to .env, then restart the server:\n\nELEVENLABS_VOICE_ID=${saved.voice_id}\n`);
} else {
  const description = flag("--description") ?? DESCRIPTION;
  console.log("Designing three previews of Grandma's voice (this takes a little while)...");
  const out = await call("/v1/text-to-voice/design", { voice_description: description, text: SAMPLE });
  const dir = join(root, "var", "voice-design");
  mkdirSync(dir, { recursive: true });
  out.previews.forEach((p, i) => {
    const file = join(dir, `preview-${i + 1}.mp3`);
    writeFileSync(file, Buffer.from(p.audio_base_64, "base64"));
    console.log(`  ${i + 1}. ${file}\n     keep it with: node tools/design-grandma-voice.mjs --save ${p.generated_voice_id}`);
  });
  console.log("\nListen to the files, then save the one that sounds most like Grandma. Not happy? Run again (each run differs), or pass --description.");
}
