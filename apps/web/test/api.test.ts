import { afterEach, describe, expect, it, vi } from "vitest";
import { api, errorMessage } from "../src/api.ts";
import { t } from "../src/strings.ts";

describe("error messages players see", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes our server's friendly 4xx messages through", () => {
    expect(errorMessage(429, "Too many questions. Grandma needs a breather.")).toBe("Too many questions. Grandma needs a breather.");
  });

  it("turns crashes, proxy pages and missing messages into one plain sentence", () => {
    expect(errorMessage(502, "<html>Bad Gateway</html>")).toBe(t("error.server"));
    expect(errorMessage(500, "Something went wrong.")).toBe(t("error.server"));
    expect(errorMessage(404, undefined)).toBe(t("error.server"));
  });

  it("never shows a schema dump when the server answers in an unexpected shape", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ weird: true }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(api.ask("run-1", "hello")).rejects.toThrow(t("error.server"));
  });

  it("says the server can't be reached when the network fails", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(api.health()).rejects.toThrow(t("error.network"));
  });
});
