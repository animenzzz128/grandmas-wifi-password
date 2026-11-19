/** The eval spend cap (eval/src/spend.ts), with a fake client: no key, no cost. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../apps/server/src/config.ts";
import { DEFAULT_MAX_USD, SpendCapError, callCost, capped, newLedger, readMaxUsd } from "../src/spend.ts";

function fakeClient(costPerCall: number | undefined) {
  let calls = 0;
  const client = {
    messages: {
      async parse(_params: never) {
        calls++;
        return { parsed_output: { ok: true }, stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 100, ...(costPerCall === undefined ? {} : { cost_usd: costPerCall }) } };
      },
    },
  };
  return { client, calls: () => calls };
}

describe("spend cap", () => {
  it("refuses the next call once spending reaches the cap, without sending it", async () => {
    const fake = fakeClient(0.4);
    const ledger = newLedger(1);
    const c = capped(fake.client, ledger);
    await c.messages.parse({} as never);
    await c.messages.parse({} as never);
    await c.messages.parse({} as never); // $0.80 < $1: allowed, and brings the total to $1.20
    await expect(c.messages.parse({} as never)).rejects.toBeInstanceOf(SpendCapError);
    expect(fake.calls()).toBe(3);
    expect(ledger.spent).toBeCloseTo(1.2);
  });

  it("shares one ledger across clients in the same run", async () => {
    const ledger = newLedger(0.5);
    const a = capped(fakeClient(0.3).client, ledger);
    const b = capped(fakeClient(0.3).client, ledger);
    await a.messages.parse({} as never);
    await b.messages.parse({} as never);
    await expect(a.messages.parse({} as never)).rejects.toThrow(/Spend cap reached/);
  });

  it("prices a call without a reported cost high, so the cap trips early", () => {
    expect(callCost({ input_tokens: 1000, output_tokens: 100, cost_usd: 0.0001 })).toBe(0.0001);
    // 1,000 in + 100 out at the fallback rate: $0.03 + $0.015
    expect(callCost({ input_tokens: 1000, output_tokens: 100 })).toBeCloseTo(0.045);
  });

  it("reads --max-usd, then EVAL_MAX_USD, then the default, and rejects a typo", () => {
    expect(readMaxUsd(["node", "run.ts", "--max-usd", "6"], {})).toBe(6);
    expect(readMaxUsd(["node", "run.ts"], { EVAL_MAX_USD: "2.5" })).toBe(2.5);
    expect(readMaxUsd(["node", "run.ts"], {})).toBe(DEFAULT_MAX_USD);
    expect(() => readMaxUsd(["node", "run.ts", "--max-usd", "6$"], {})).toThrow(/positive number/);
    expect(() => readMaxUsd(["node", "run.ts", "--max-usd", "0"], {})).toThrow(/positive number/);
  });

  it("keeps the wrapped client's other members", async () => {
    const inner = { messages: { parse: async (_params: never) => ({ usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } }) }, name: "inner" };
    const c = capped(inner, newLedger(1));
    expect(c.name).toBe("inner");
    await c.messages.parse({} as never);
  });
});

describe("no uncapped paid client in the eval tools", () => {
  // Every paid client must come from realClient() or be wrapped in capped(), or the cap can be bypassed.
  const dir = join(REPO_ROOT, "eval/src");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "spend.ts");

  it.each(files)("%s builds paid clients only through the cap", (file) => {
    const lines = readFileSync(join(dir, file), "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const where = `eval/src/${file}:${i + 1}`;
      if (/new LlmBrain\(/.test(line)) expect(line, `${where}: give LlmBrain { client: realClient(...) }, not a key`).not.toMatch(/apiKey\s*:/);
      if (/openRouterClient\(|new Anthropic\(/.test(line)) {
        const inLlmTs = file === "llm.ts" && (/return capped\(/.test(line) || /^\s+new Anthropic\(\{$/.test(line));
        expect(inLlmTs || /capped\(/.test(line), `${where}: wrap paid clients in capped() (eval/src/spend.ts)`).toBe(true);
      }
    });
  });
});
