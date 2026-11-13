import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.ts";

describe("config", () => {
  it("uses the key from the project's .env", () => {
    expect(readConfig({}, {}).grandmaMode).toBe("mock");
    const c = readConfig({ ANTHROPIC_API_KEY: "ambient" }, { ANTHROPIC_API_KEY: "project" });
    expect(c.grandmaMode).toBe("llm");
    expect(c.apiKey).toBe("project");
  });

  it("ignores credentials other tools put in the environment", () => {
    expect(readConfig({ ANTHROPIC_API_KEY: "ambient" }, {}).grandmaMode).toBe("mock");
    expect(readConfig({ ANTHROPIC_AUTH_TOKEN: "ambient" }, {}).grandmaMode).toBe("mock");
  });

  it("uses an environment key only when GRANDMA_MODE=llm opts in (deployments)", () => {
    const c = readConfig({ ANTHROPIC_API_KEY: "secret", GRANDMA_MODE: "llm" }, {});
    expect(c.grandmaMode).toBe("llm");
    expect(() => readConfig({ GRANDMA_MODE: "llm" }, {})).toThrow();
  });

  it("--mock wins over everything", () => {
    expect(readConfig({}, { ANTHROPIC_API_KEY: "project" }, ["--mock"]).grandmaMode).toBe("mock");
  });

  it("ignores ambient PORT and ANTHROPIC_BASE_URL", () => {
    const c = readConfig({ PORT: "5173", ANTHROPIC_BASE_URL: "http://elsewhere" }, {});
    expect(c.port).toBe(8787);
    expect(c.apiBaseUrl).toBe("https://api.anthropic.com");
  });
});
