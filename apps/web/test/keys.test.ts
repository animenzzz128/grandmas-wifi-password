import { describe, expect, it } from "vitest";
import { DEFAULT_KEYS, keyLabel, rebind, useSettings } from "../src/settings.ts";
import { t } from "../src/strings.ts";

describe("remappable keys (plan C6)", () => {
  it("binds a key, swapping with the action that had it", () => {
    const k = rebind(DEFAULT_KEYS, "use", "KeyF");
    expect(k.use).toBe("KeyF");
    const swapped = rebind(DEFAULT_KEYS, "use", "KeyQ");
    expect(swapped.use).toBe("KeyQ");
    expect(swapped.putBack).toBe("KeyE"); // Q's old job gets E
    expect(new Set(Object.values(swapped)).size).toBe(Object.keys(swapped).length);
  });

  it("names keys the way players read them", () => {
    expect(keyLabel("KeyW")).toBe("W");
    expect(keyLabel("Digit1")).toBe("1");
    expect(keyLabel("ArrowUp")).toBe("↑");
    expect(keyLabel("Tab")).toBe("Tab");
  });

  it("on-screen prompts follow the player's keys", () => {
    expect(t("prompt.grandma")).toBe("E · Talk to Grandma");
    expect(t("controls.basic")).toContain("WASD walk");
    useSettings.setState({ keys: { ...DEFAULT_KEYS, use: "KeyF", forward: "KeyZ", left: "KeyQ", putBack: "KeyR" } });
    try {
      expect(t("prompt.grandma")).toBe("F · Talk to Grandma");
      expect(t("carry.cookie")).toBe("Carrying a cookie · F on Grandma to give it · R to put it back");
      expect(t("controls.basic")).toContain("ZQSD walk");
      expect(t("prompt.clue", { label: "old sled" })).toBe("F · Look at the old sled");
    } finally {
      useSettings.setState({ keys: DEFAULT_KEYS });
    }
  });
});
