/**
 * OpenRouter access with the same `messages.parse` shape as the Anthropic SDK, so Grandma's brain and the eval
 * tools run on an OpenRouter key without changes (iteration 62). One key reaches Claude, GPT, Gemini, DeepSeek…;
 * the model is `GRANDMA_MODEL` ("anthropic/claude-haiku-5.5", or the old "claude-haiku-5-5", which maps to it).
 *
 * The request asks OpenRouter for:
 * - strict JSON output against the reply's schema, and only providers that honour every parameter sent
 *   (`require_parameters`), so a provider that would ignore the schema is never picked;
 * - only providers that don't keep or train on prompts (`data_collection: "deny"`): players type free text;
 * - the call's real price (`usage.cost`), which the daily budget counts instead of a fixed price table.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const isOpenRouterKey = (key: string | undefined): boolean => Boolean(key && /^sk-or-/.test(key));

/** "claude-haiku-5-5" → "anthropic/claude-haiku-5.5"; ids that already name a provider are kept. */
export function openRouterModel(id: string): string {
  if (id.includes("/")) return id;
  const claude = /^claude-([a-z]+)-(\d+)(?:-(\d+))?$/.exec(id);
  return claude ? `anthropic/claude-${claude[1]}-${claude[2]}${claude[3] ? `.${claude[3]}` : ""}` : id;
}

export class OpenRouterError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type TextBlock = { type: "text"; text: string; cache_control?: unknown };
type Content = string | TextBlock[];
interface ParseParams {
  model: string;
  max_tokens: number;
  system?: Content;
  messages: { role: "user" | "assistant" | "system"; content: Content }[];
  output_config?: { effort?: string; format?: { schema: Record<string, unknown>; parse(content: string): unknown } };
}

/**
 * The SDK's zod helper writes enums without a "type" and puts a "$schema" note in the root description. Strict JSON
 * modes elsewhere (OpenAI's in particular) want every node typed, so fill those in.
 */
export function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "description" && typeof v === "string" && v.startsWith("{$schema")) continue;
    out[k] = k === "enum" || k === "required" ? v : strictSchema(v);
  }
  if (Array.isArray(out.enum) && !out.type && out.enum.every((e) => typeof e === "string")) out.type = "string";
  return out;
}

const toParts = (c: Content) => (typeof c === "string" ? c : c.map((b) => ({ type: "text", text: b.text, ...(b.cache_control ? { cache_control: b.cache_control } : {}) })));

/** The request body OpenRouter gets for one Anthropic-style `messages.parse` call (exported for tests). */
export function toOpenRouterRequest(p: ParseParams, mustReason = false): Record<string, unknown> {
  const model = openRouterModel(p.model);
  const thinkingOff = model.startsWith("anthropic/") && !mustReason;
  const format = p.output_config?.format;
  const effort = p.output_config?.effort;
  return {
    model,
    max_tokens: p.max_tokens,
    // System blocks keep their cache_control: OpenRouter passes it to Anthropic and Gemini; others cache by themselves.
    messages: [...(p.system ? [{ role: "system", content: toParts(p.system) }] : []), ...p.messages.map((m) => ({ role: m.role, content: toParts(m.content) }))],
    ...(format ? { response_format: { type: "json_schema", json_schema: { name: "reply", strict: true, schema: strictSchema(format.schema) } } } : {}),
    // Claude through OpenRouter thinks before answering unless told not to: measured on Haiku 5.5, ~490 hidden tokens
    // a turn, a 3.3–4.0 s median instead of ~1.4–1.6 s, and replies cut off at max_tokens (eval/src/probe-reasoning.ts).
    // The game was tuned on Claude without thinking, so turn it off. Some models refuse that (Sonnet 5.5: "Reasoning is
    // mandatory"); they, and other families, get the requested effort, at most "low" for a model that must think.
    ...(thinkingOff ? { reasoning: { enabled: false } } : effort || mustReason ? { reasoning: { effort: mustReason ? "low" : effort, exclude: true } } : {}),
    provider: { require_parameters: true, data_collection: "deny" },
    usage: { include: true },
  };
}

interface ChatResponse {
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number; prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } };
  error?: { message?: string; code?: number };
}

/** A client with the Anthropic SDK's `messages.parse` shape that calls OpenRouter's chat completions. */
export function openRouterClient(opts: { apiKey: string; baseURL?: string; timeoutMs?: number; fetch?: typeof fetch }) {
  const doFetch = opts.fetch ?? fetch;
  /** Models that refused to answer without reasoning; asked again with the lowest effort, and from then on. */
  const mustReason = new Set<string>();
  const send = (p: ParseParams) =>
    doFetch(`${opts.baseURL ?? OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.apiKey}`,
        "content-type": "application/json",
        // OpenRouter's optional app attribution: a generic name, nothing about the player or the team.
        "x-title": "Grandma's Wi-Fi Password",
      },
      body: JSON.stringify(toOpenRouterRequest(p, mustReason.has(openRouterModel(p.model)))),
      ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
    });
  return {
    messages: {
      async parse(p: ParseParams) {
        let res = await send(p);
        let body = (await res.json().catch(() => ({}))) as ChatResponse;
        if (res.status === 400 && /reasoning is mandatory/i.test(body.error?.message ?? "") && !mustReason.has(openRouterModel(p.model))) {
          mustReason.add(openRouterModel(p.model));
          res = await send(p);
          body = (await res.json().catch(() => ({}))) as ChatResponse;
        }
        // Errors can also arrive with status 200 and an `error` object (e.g. the provider failed mid-request).
        if (!res.ok || body.error) throw new OpenRouterError(body.error?.code ?? res.status, body.error?.message ?? res.statusText);
        const choice = body.choices?.[0];
        const u = body.usage ?? {};
        const cacheRead = u.prompt_tokens_details?.cached_tokens ?? 0;
        const cacheWrite = u.prompt_tokens_details?.cache_write_tokens ?? 0;
        const usage = {
          // Anthropic counts cached tokens apart from input_tokens; OpenRouter's prompt_tokens include them.
          input_tokens: Math.max(0, (u.prompt_tokens ?? 0) - cacheRead - cacheWrite),
          output_tokens: u.completion_tokens ?? 0,
          cache_read_input_tokens: cacheRead,
          cache_creation_input_tokens: cacheWrite,
          cost_usd: typeof u.cost === "number" ? u.cost : undefined,
        };
        if (choice?.message?.refusal) return { parsed_output: null, stop_reason: "refusal", usage };
        let parsed_output: unknown = null;
        const content = choice?.message?.content;
        if (content && p.output_config?.format) {
          try {
            parsed_output = p.output_config.format.parse(content);
          } catch {
            parsed_output = null; // not valid JSON for the schema: the validator treats it as no output and retries
          }
        }
        return { parsed_output, stop_reason: choice?.finish_reason ?? null, usage };
      },
    },
  };
}
