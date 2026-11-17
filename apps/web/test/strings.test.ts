import { describe, expect, it } from "vitest";
import { t } from "../src/strings.ts";

describe("UI strings", () => {
  it("uses the singular variant for one", () => {
    expect(t("result.cardSolved", { n: 1 })).toBe("Solved in 1 question");
    expect(t("result.cardSolved", { n: 7 })).toBe("Solved in 7 questions");
    expect(t("daily.solved", { n: 1, stars: "⭐" })).toBe("You solved today's in 1 question ⭐");
  });

  it("falls back to the plain string when there is no singular variant", () => {
    expect(t("start", { n: 1 })).toBe("Visit Grandma");
  });
});
