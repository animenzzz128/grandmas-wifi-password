import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HealthResponse, RunView } from "@gwp/engine";
import { createApp } from "../src/app.ts";
import { readConfig } from "../src/config.ts";
import { loadGameData } from "../src/data.ts";
import { MockBrain } from "../src/grandma.ts";
import { RunStore } from "../src/store.ts";

const data = loadGameData(readConfig({}, {}).dataDir);
const TOKEN = "test-token-0123456789";
const basic = (pass: string) => `Basic ${Buffer.from(`me:${pass}`).toString("base64")}`;

/** An app with real turn logs, in a scratch folder left for the OS to clean (the project avoids deletes in code). */
function appWithLogs(extra: Partial<Parameters<typeof createApp>[0]> = {}) {
  const store = new RunStore(mkdtempSync(join(tmpdir(), "gwp-admin-")));
  return createApp({ data, brain: new MockBrain(), store, asksPerMinute: 1000, runsPerMinute: 1000, ...extra });
}

async function post(app: ReturnType<typeof createApp>, path: string, payload: unknown): Promise<unknown> {
  const res = await app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  return res.json();
}

describe("play stats at /admin", () => {
  it("doesn't exist without ADMIN_TOKEN", async () => {
    const app = appWithLogs();
    expect((await app.request("/admin")).status).toBe(404);
    expect((await app.request("/api/admin/stats", { headers: { authorization: basic("anything") } })).status).toBe(404);
  });

  it("asks for the token, and turns a wrong one away", async () => {
    const app = appWithLogs({ adminToken: TOKEN });
    const none = await app.request("/admin");
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toMatch(/Basic/);
    expect((await app.request("/admin", { headers: { authorization: basic("wrong-token-0123456789") } })).status).toBe(401);
    expect((await app.request("/admin", { headers: { authorization: "Bearer " + TOKEN } })).status).toBe(401);
  });

  it("shows visits, solves and tiers from the logs, and never what anyone typed", async () => {
    const app = appWithLogs({ adminToken: TOKEN });
    const run = RunView.parse(await post(app, "/api/runs", { recipeId: "r_easy" }));
    await post(app, `/api/runs/${run.runId}/ask`, { text: "Zanzibar marmalade question about the sock thief" });
    await post(app, `/api/runs/${run.runId}/guess`, { parts: ["Biscuit", "1961"] });
    await post(app, "/api/runs", { difficulty: "hard" });

    const json = (await (await app.request("/api/admin/stats?days=7", { headers: { authorization: basic(TOKEN) } })).json()) as {
      days: number;
      stats: { runs: number; tiers: { tier: string; runs: number; solved: number }[]; byDay: { visits: number; solved: number }[] };
    };
    expect(json.days).toBe(7);
    expect(json.stats.runs).toBe(2);
    expect(json.stats.tiers.find((t) => t.tier === "easy")).toMatchObject({ runs: 1, solved: 1 });
    expect(json.stats.tiers.find((t) => t.tier === "hard")).toMatchObject({ runs: 1, solved: 0 });
    expect(json.stats.byDay.reduce((n, d) => n + d.visits, 0)).toBe(2);

    const res = await app.request("/admin", { headers: { authorization: basic(TOKEN) } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("Play stats");
    expect(html).toContain("By difficulty");
    expect(html).not.toMatch(/Zanzibar|marmalade/);
    expect(html).not.toContain("Biscuit");
  });
});

describe("GoatCounter page views (optional)", () => {
  it("is off by default: no script allowed, nothing in health", async () => {
    const app = appWithLogs();
    const res = await app.request("/api/health");
    expect(HealthResponse.parse(await res.json()).goatcounter).toBeUndefined();
    expect(res.headers.get("content-security-policy")).not.toContain("gc.zgo.at");
  });

  it("when on, health names the count URL and the CSP allows its script and site", async () => {
    const url = "https://grandma-test.goatcounter.com/count";
    const app = appWithLogs({ goatcounter: url });
    const res = await app.request("/api/health");
    expect(HealthResponse.parse(await res.json()).goatcounter).toBe(url);
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("https://gc.zgo.at");
    expect(csp).toContain("https://grandma-test.goatcounter.com");
  });

  it("reads the code from GOATCOUNTER_CODE and the token from ADMIN_TOKEN, refusing bad values", () => {
    expect(readConfig({}, { GOATCOUNTER_CODE: "grandma" }).goatcounter).toBe("https://grandma.goatcounter.com/count");
    expect(readConfig({}, { GOATCOUNTER_CODE: "evil.com/x" }).goatcounter).toBeUndefined();
    expect(readConfig({}, { ADMIN_TOKEN: "short" }).adminToken).toBeUndefined();
    expect(readConfig({}, { ADMIN_TOKEN: TOKEN }).adminToken).toBe(TOKEN);
  });
});
