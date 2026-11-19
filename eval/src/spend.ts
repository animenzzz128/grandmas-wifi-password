/**
 * Hard spend cap for the offline tools that call a paid model (eval --brain llm, judge, AI player, question
 * generator, reasoning probe). Every paid client those tools build goes through `capped()`, so the cap holds
 * whichever tool runs, instead of relying on someone remembering a budget (the 2026-11-18 bake-off went
 * about $0.40 past what was approved).
 *
 * - The cap is per process: `--max-usd N`, else EVAL_MAX_USD in the repo's .env, else $1.
 * - Before each call: if spending has reached the cap, throw SpendCapError and make no call. So the run can go
 *   past the cap by at most the calls already in flight (one per concurrent worker).
 * - Cost per call: the provider's own price when it reports one (OpenRouter does), else a deliberately high
 *   flat rate, so without a reported price the cap trips early rather than late.
 * - The total is printed when the process exits.
 *
 * The game server has its own guard for players (apps/server/src/budget.ts); this one is for development runs.
 */
import { loadEnv } from "../../apps/server/src/config.ts";

export const DEFAULT_MAX_USD = 1;

/** Used only when the provider reports no price. Per million tokens; high on purpose. */
export const FALLBACK_PRICE_PER_MTOK = { input: 30, output: 150 };

export class SpendCapError extends Error {
  constructor(public spent: number, public cap: number) {
    super(`Spend cap reached: $${spent.toFixed(4)} spent of a $${cap.toFixed(2)} cap. Nothing more was sent. Raise it with --max-usd N (or EVAL_MAX_USD in .env) if the extra spend is approved.`);
    this.name = "SpendCapError";
  }
}

/** The cap for this process. Throws on a value that isn't a positive number, so a typo can't mean "no cap". */
export function readMaxUsd(argv: readonly string[] = process.argv, env: Record<string, string | undefined> = loadEnv()): number {
  const i = argv.indexOf("--max-usd");
  const raw = i >= 0 ? argv[i + 1] : env.EVAL_MAX_USD;
  if (raw === undefined || raw === "") return DEFAULT_MAX_USD;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--max-usd / EVAL_MAX_USD must be a positive number of dollars, got "${raw}".`);
  return n;
}

export interface Ledger {
  cap: number;
  spent: number;
  calls: number;
}

export function newLedger(cap: number): Ledger {
  return { cap, spent: 0, calls: 0 };
}

let processLedger: Ledger | null = null;

/** The one ledger for this process, created on first use, which prints the total on exit. */
export function ledger(): Ledger {
  if (!processLedger) {
    const l = newLedger(readMaxUsd());
    processLedger = l;
    process.on("exit", () => {
      if (l.calls > 0) console.error(`[spend] $${l.spent.toFixed(4)} over ${l.calls} paid calls (cap $${l.cap.toFixed(2)})`);
    });
  }
  return processLedger;
}

interface ParseUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** What one call cost: the provider's price if given, else the fallback rate on every token sent and received. */
export function callCost(usage: ParseUsage | undefined): number {
  if (!usage) return 0;
  if (typeof usage.cost_usd === "number") return usage.cost_usd;
  const input = usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  return (input * FALLBACK_PRICE_PER_MTOK.input + usage.output_tokens * FALLBACK_PRICE_PER_MTOK.output) / 1e6;
}

/**
 * Wrap a client so every `messages.parse` call is counted against the ledger and refused once the cap is reached.
 * Works for the Anthropic SDK client, the OpenRouter client and test fakes (all expose `messages.parse`).
 */
export function capped<C extends { messages: { parse(params: never): Promise<unknown> } }>(client: C, l: Ledger = ledger()): C {
  const parse = client.messages.parse.bind(client.messages) as (params: unknown) => Promise<{ usage?: ParseUsage }>;
  const messages = Object.create(client.messages) as C["messages"];
  (messages as unknown as { parse: typeof parse }).parse = async (params: unknown) => {
    if (l.spent >= l.cap) throw new SpendCapError(l.spent, l.cap);
    l.calls++;
    const response = await parse(params);
    l.spent += callCost(response?.usage);
    return response;
  };
  const wrapped = Object.create(client) as C;
  Object.defineProperty(wrapped, "messages", { value: messages });
  return wrapped;
}
