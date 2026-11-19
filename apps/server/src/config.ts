import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { OPENROUTER_BASE_URL, isOpenRouterKey, openRouterModel } from "./openrouter.ts";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

type Env = Record<string, string | undefined>;

/**
 * The repo-root .env, parsed but NOT merged into process.env. The project's .env is the source of
 * truth: it wins over same-named variables that other tools may have put in the environment.
 */
export function loadEnv(): Env {
  const envFile = join(REPO_ROOT, ".env");
  return existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
}

export interface Config {
  port: number;
  grandmaModel: string;
  grandmaMode: "llm" | "mock";
  apiKey: string | undefined;
  /** Who the key belongs to: an OpenRouter key (sk-or-…) goes to OpenRouter, anything else to Anthropic. */
  provider: "anthropic" | "openrouter";
  apiBaseUrl: string;
  asksPerMinute: number;
  /** Daily model spend limit in USD (UTC day); past it Grandma goes offline until midnight UTC. */
  dailyBudgetUsd: number;
  /** EMBED_ORIGINS: space-separated sites allowed to frame the game (an itch.io embed). Empty: none. */
  embedOrigins: string[];
  /**
   * ADMIN_TOKEN: the password for the /admin play-stats page (any user name). Off unless set, and at least 16
   * characters, so a short guessable one can't open it.
   */
  adminToken: string | undefined;
  /** GOATCOUNTER_CODE: page-view counting with GoatCounter (https://<code>.goatcounter.com). Off unless set. */
  goatcounter: string | undefined;
  /** Grandma's spoken voice (ElevenLabs). Off unless both a key and a voice id are set. */
  voice: { apiKey: string; voiceId: string; model: string; dailyChars: number } | undefined;
  dataDir: string;
  varDir: string;
  webDist: string;
}

/**
 * Which key Grandma uses (OPENROUTER_API_KEY first, then ANTHROPIC_API_KEY):
 * - the key in the repo's .env (normal local setup), or
 * - the key in the environment only when GRANDMA_MODE=llm is also set (deployments, e.g. Fly secrets).
 * Anything else (ANTHROPIC_AUTH_TOKEN, a key some other tool exported) is ignored, so the game never
 * spends money on a credential that isn't the project's. `--mock` or GRANDMA_MODE=mock forces the offline Grandma.
 */
export function readConfig(env: Env = process.env, dotenv: Env = {}, argv: readonly string[] = []): Config {
  const get = (k: string) => dotenv[k] || env[k] || undefined;
  const mode = argv.includes("--mock") ? "mock" : get("GRANDMA_MODE");
  const projectKey = (name: string) => dotenv[name] || (mode === "llm" ? env[name] : undefined) || undefined;
  // An OpenRouter key works under either name (iteration 62: the course key turned out to be one).
  const apiKey = projectKey("OPENROUTER_API_KEY") || projectKey("ANTHROPIC_API_KEY");
  if (mode === "llm" && !apiKey) throw new Error("GRANDMA_MODE=llm but no OPENROUTER_API_KEY or ANTHROPIC_API_KEY was found.");
  const provider = isOpenRouterKey(apiKey) ? "openrouter" : "anthropic";
  const model = get("GRANDMA_MODEL") || "claude-haiku-5-5";
  return {
    // API_PORT, not PORT: dev tools and hosts often inject PORT for the web server.
    port: Number(get("API_PORT") || 8787),
    grandmaModel: provider === "openrouter" ? openRouterModel(model) : model,
    grandmaMode: mode === "mock" ? "mock" : apiKey ? "llm" : "mock",
    apiKey,
    provider,
    // Pinned so an ambient ANTHROPIC_BASE_URL (e.g. from another tool) can't redirect the project key.
    apiBaseUrl: get("GRANDMA_API_BASE_URL") || (provider === "openrouter" ? OPENROUTER_BASE_URL : "https://api.anthropic.com"),
    asksPerMinute: Number(get("RATE_LIMIT_ASKS_PER_MIN") || 30),
    dailyBudgetUsd: Number(get("GRANDMA_DAILY_BUDGET_USD") || 5),
    embedOrigins: (get("EMBED_ORIGINS") ?? "").split(/\s+/).filter((o) => /^https:\/\/[a-z0-9.*-]+(:\d+)?$/i.test(o)),
    adminToken: (get("ADMIN_TOKEN") ?? "").length >= 16 ? get("ADMIN_TOKEN") : undefined,
    goatcounter: /^[a-z0-9-]{1,40}$/.test(get("GOATCOUNTER_CODE") ?? "") ? `https://${get("GOATCOUNTER_CODE")}.goatcounter.com/count` : undefined,
    // Same rule as the Anthropic key: the repo's .env, or the environment only when deploying on purpose.
    voice: (() => {
      const key = dotenv.ELEVENLABS_API_KEY || (get("GRANDMA_VOICE") === "elevenlabs" ? env.ELEVENLABS_API_KEY : undefined);
      const voiceId = get("ELEVENLABS_VOICE_ID");
      if (!key || !voiceId || get("GRANDMA_VOICE") === "browser") return undefined;
      return { apiKey: key, voiceId, model: get("ELEVENLABS_MODEL") || "eleven_flash_v2_5", dailyChars: Number(get("VOICE_DAILY_CHARS") || 3000) };
    })(),
    dataDir: join(REPO_ROOT, "data"),
    varDir: get("VAR_DIR") || join(REPO_ROOT, "var"),
    webDist: join(REPO_ROOT, "apps/web/dist"),
  };
}
