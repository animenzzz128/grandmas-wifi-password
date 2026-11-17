/**
 * Shared Claude access for the eval tools (judge, AI player, question generator).
 * Same pattern as the game's Grandma brain: messages.parse with a zod output format.
 * Only the API key in the repo's .env is used (never one from the shell environment).
 * Tests pass a fake client with the same `messages.parse` shape, so nothing here needs a key to test.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { loadEnv, readConfig } from "../../apps/server/src/config.ts";

export interface Usage {
  input: number;
  output: number;
}

/** The one SDK method the eval tools use; the real client and test fakes both provide it. */
export interface ParseClient {
  messages: {
    parse(params: unknown): Promise<{
      parsed_output?: unknown;
      stop_reason?: string | null;
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export const MODELS = {
  judge: "claude-opus-5-5",
  player: "claude-sonnet-5-5",
  qgen: "claude-opus-5-5",
} as const;

export function realClient(): ParseClient {
  const config = readConfig({}, loadEnv());
  if (!config.apiKey) throw new Error("No ANTHROPIC_API_KEY in the repo's .env. These eval tools need the course key there.");
  return new Anthropic({ apiKey: config.apiKey, authToken: null, baseURL: config.apiBaseUrl }) as unknown as ParseClient;
}

/** One structured call. Returns null output on refusal or a parse failure, plus token usage. */
export async function structured<S extends z.ZodType>(
  client: ParseClient,
  args: { model: string; system: string; user: string; schema: S; effort?: "low" | "medium" | "high"; maxTokens?: number },
): Promise<{ output: z.infer<S> | null; usage: Usage }> {
  const response = await client.messages.parse({
    model: args.model,
    max_tokens: args.maxTokens ?? 4000,
    output_config: { effort: args.effort ?? "medium", format: zodOutputFormat(args.schema) },
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });
  const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };
  if (response.stop_reason === "refusal") return { output: null, usage };
  return { output: (response.parsed_output ?? null) as z.infer<S> | null, usage };
}

export function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

export const stamp = () => new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
