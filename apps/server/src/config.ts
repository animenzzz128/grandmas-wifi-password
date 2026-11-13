import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

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
  apiBaseUrl: string;
  asksPerMinute: number;
  dataDir: string;
  varDir: string;
  webDist: string;
}

/**
 * Which key Grandma uses:
 * - ANTHROPIC_API_KEY in the repo's .env (normal local setup), or
 * - ANTHROPIC_API_KEY in the environment only when GRANDMA_MODE=llm is also set (deployments, e.g. Fly secrets).
 * Anything else (ANTHROPIC_AUTH_TOKEN, a key some other tool exported) is ignored, so the game never
 * spends money on a credential that isn't the project's. `--mock` or GRANDMA_MODE=mock forces the offline Grandma.
 */
export function readConfig(env: Env = process.env, dotenv: Env = {}, argv: readonly string[] = []): Config {
  const get = (k: string) => dotenv[k] || env[k] || undefined;
  const mode = argv.includes("--mock") ? "mock" : get("GRANDMA_MODE");
  const apiKey = dotenv.ANTHROPIC_API_KEY || (mode === "llm" ? env.ANTHROPIC_API_KEY : undefined) || undefined;
  if (mode === "llm" && !apiKey) throw new Error("GRANDMA_MODE=llm but no ANTHROPIC_API_KEY was found.");
  return {
    // API_PORT, not PORT: dev tools and hosts often inject PORT for the web server.
    port: Number(get("API_PORT") || 8787),
    grandmaModel: get("GRANDMA_MODEL") || "claude-haiku-5-5",
    grandmaMode: mode === "mock" ? "mock" : apiKey ? "llm" : "mock",
    apiKey,
    // Pinned so an ambient ANTHROPIC_BASE_URL (e.g. from another tool) can't redirect the project key.
    apiBaseUrl: get("GRANDMA_API_BASE_URL") || "https://api.anthropic.com",
    asksPerMinute: Number(get("RATE_LIMIT_ASKS_PER_MIN") || 30),
    dataDir: join(REPO_ROOT, "data"),
    varDir: get("VAR_DIR") || join(REPO_ROOT, "var"),
    webDist: join(REPO_ROOT, "apps/web/dist"),
  };
}
