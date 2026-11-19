/**
 * Grandma's "brain": the LLM (Claude Haiku 5.5, directly or through OpenRouter) or the offline mock. Both go through the same
 * validator, one retry, and a safe fallback line (technical design §5, steps ⑤–⑥).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { OpenRouterError, openRouterClient } from "./openrouter.ts";
import { z } from "zod";
import {
  MoodSchema,
  buildMessages,
  buildSystemPrompt,
  buildWorldBlock,
  retrieveFacts,
  mockGrandmaReply,
  pick,
  rng,
  hashString,
  validateReply,
  validationContext,
} from "@gwp/engine";
import type { GrandmaOutput, GrandmaWorld, Recipe, RunState, TurnInput, GrandmaLines } from "@gwp/engine";

export interface ReplyArgs {
  world: GrandmaWorld;
  recipe: Recipe;
  run: RunState;
  input: TurnInput;
  lines: GrandmaLines;
}

export interface BrainResult {
  output: GrandmaOutput;
  attempts: number;
  validatorErrors: string[];
  fallback: boolean;
  latencyMs: number;
  /** Tokens, plus the provider's own price for the calls when it reports one (OpenRouter does). */
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; costUsd?: number };
}

export interface GrandmaBrain {
  mode: "llm" | "mock";
  model?: string;
  reply(args: ReplyArgs): Promise<BrainResult>;
}

/** Switches for the evaluation's ablations (docs/04-evaluation-plan.md §5). The game uses the defaults. */
export interface BrainOptions {
  /** Validate replies, retry once and fall back (default true). Off: the first reply is used as is. */
  validate?: boolean;
  /** Model effort (LLM only; default "low"). */
  effort?: "low" | "medium" | "high";
  /** "full" (config A, default): every memory, cached. "retrieval" (config B): the memories picked for this turn. */
  context?: "full" | "retrieval";
}

const GrandmaReply = z.object({
  reply: z.string(),
  fact_ids_used: z.array(z.string()),
  distractor_ids: z.array(z.string()),
  mood: MoodSchema,
});

const MAX_ATTEMPTS = 2;

type Generate = (args: ReplyArgs, priorErrors: string[]) => Promise<{ output: GrandmaOutput | null; usage?: BrainResult["usage"] }>;

async function withValidation(args: ReplyArgs, generate: Generate, validate = true): Promise<BrainResult> {
  const started = Date.now();
  const ctx = validationContext(args.world, args.recipe);
  const allErrors: string[] = [];
  let errors: string[] = [];
  const usage: NonNullable<BrainResult["usage"]> = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (let attempt = 1; attempt <= (validate ? MAX_ATTEMPTS : 1); attempt++) {
    const { output, usage: u } = await generate(args, errors);
    if (u) {
      usage.input += u.input;
      usage.output += u.output;
      usage.cacheRead += u.cacheRead;
      usage.cacheWrite += u.cacheWrite;
      if (u.costUsd !== undefined) usage.costUsd = (usage.costUsd ?? 0) + u.costUsd;
    }
    errors = output ? validateReply(args.world, output, ctx) : ["no parseable output"];
    allErrors.push(...errors.map((e) => `attempt ${attempt}: ${e}`));
    if (output && (errors.length === 0 || !validate)) {
      return { output, attempts: attempt, validatorErrors: allErrors, fallback: false, latencyMs: Date.now() - started, usage };
    }
  }
  const rand = rng(hashString(`${args.run.id}:${args.run.questionCount}`));
  return {
    output: { reply: pick(args.lines.fallback, rand), fact_ids_used: [], distractor_ids: [], mood: "confused" },
    attempts: MAX_ATTEMPTS,
    validatorErrors: allErrors,
    fallback: true,
    latencyMs: Date.now() - started,
    usage,
  };
}

export class MockBrain implements GrandmaBrain {
  mode = "mock" as const;
  constructor(private options: BrainOptions = {}) {}
  reply(args: ReplyArgs): Promise<BrainResult> {
    return withValidation(args, async () => ({
      output: mockGrandmaReply({
        world: args.world,
        recipe: args.recipe,
        input: args.input,
        seed: `${args.run.id}:${args.run.questionCount}`,
        recentFactIds: args.run.lastFactIds,
        heardFactIds: args.run.heard ?? [],
        saidText: args.run.history
          .filter((t) => t.role === "grandma")
          .map((t) => t.text)
          .join(" "),
      }),
    }), this.options.validate ?? true);
  }
}

/** Per-request time limit for the model call (ms). A Haiku reply usually takes 1–3 s. */
export const LLM_TIMEOUT_MS = 12_000;

export class LlmBrain implements GrandmaBrain {
  mode = "llm" as const;
  private client: Anthropic;

  constructor(
    public model: string,
    opts: { apiKey: string; baseURL: string; provider?: "anthropic" | "openrouter" } | { client: Anthropic },
    private options: BrainOptions = {},
  ) {
    // Explicit key and base URL: only the project's key from .env, never other credentials in the environment.
    // A player is waiting: give up on a slow call after LLM_TIMEOUT_MS (the validation loop already tries twice) and let the free fallback line answer,
    // instead of the SDK default of 10 minutes with two retries.
    this.client =
      "client" in opts
        ? opts.client
        : opts.provider === "openrouter"
          ? (openRouterClient({ apiKey: opts.apiKey, baseURL: opts.baseURL, timeoutMs: LLM_TIMEOUT_MS }) as unknown as Anthropic)
          : new Anthropic({ apiKey: opts.apiKey, authToken: null, baseURL: opts.baseURL, timeout: LLM_TIMEOUT_MS, maxRetries: 0 });
  }

  reply(args: ReplyArgs): Promise<BrainResult> {
    return withValidation(args, (a, priorErrors) => this.generate(a, priorErrors), this.options.validate ?? true);
  }

  private async generate(args: ReplyArgs, priorErrors: string[]) {
    const year = new Date().getFullYear();
    const messages: Anthropic.MessageParam[] = buildMessages(args.run.history, args.input, args.run.stamina, 6, args.world.profile.verbal_tics);
    if (priorErrors.length) {
      // Mid-conversation operator note (supported on Haiku 5.5): explain what was wrong, ask for a rewrite.
      messages.push({
        role: "system",
        content: `Your previous reply was rejected by the game's fact checker: ${priorErrors.join("; ")}. Answer the same message again, using only your MEMORIES.`,
      });
    }
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        // A reply is at most 700 characters (~200 tokens) plus its JSON; 1000 leaves room and halves the worst case.
        max_tokens: 1000,
        // Low effort keeps latency down; the eval will measure whether quality holds (technical design §5.3).
        output_config: { effort: this.options.effort ?? "low", format: zodOutputFormat(GrandmaReply) },
        system:
          this.options.context === "retrieval"
            ? [
                { type: "text", text: buildSystemPrompt(args.world, year) },
                // Config B: this turn's memories only (changes every turn, so not cached).
                { type: "text", text: buildWorldBlock(args.world, args.recipe, retrieveFacts(args.world, args.input, args.run.lastFactIds, { seed: `${args.run.id}:${args.run.questionCount}` })) },
              ]
            : [
                { type: "text", text: buildSystemPrompt(args.world, year) },
                // The world block is identical for every turn of every run on this world, so cache it.
                { type: "text", text: buildWorldBlock(args.world, args.recipe), cache_control: { type: "ephemeral" } },
              ],
        messages,
      });
      const usage = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
        // Only the OpenRouter client sets this: what the call really cost, whichever model answered.
        ...(typeof (response.usage as { cost_usd?: number }).cost_usd === "number" ? { costUsd: (response.usage as { cost_usd?: number }).cost_usd } : {}),
      };
      if (response.stop_reason === "refusal") return { output: null, usage };
      return { output: response.parsed_output ?? null, usage };
    } catch (err) {
      if (err instanceof OpenRouterError)
        console.error(
          err.status === 401 ? "[grandma] OpenRouter key rejected; check the key in .env" : err.status === 402 ? "[grandma] OpenRouter account is out of credits" : `[grandma] OpenRouter error ${err.status}: ${err.message}`,
        );
      else if (err instanceof Error && err.name === "TimeoutError") console.warn(`[grandma] no reply within ${LLM_TIMEOUT_MS} ms`);
      else if (err instanceof Anthropic.RateLimitError) console.warn("[grandma] rate limited");
      else if (err instanceof Anthropic.AuthenticationError) console.error("[grandma] API key rejected; check ANTHROPIC_API_KEY in .env");
      else if (err instanceof Anthropic.APIError) console.error(`[grandma] API error ${err.status}: ${err.message}`);
      else console.error("[grandma] unexpected error", err);
      return { output: null };
    }
  }
}
