import { describe, expect, it } from "vitest";
import { applyTextSettings } from "../src/settings.ts";

function fakeRoot() {
  const props: Record<string, string> = {};
  const classes = new Set<string>();
  return {
    props,
    classes,
    el: {
      style: { setProperty: (k: string, v: string) => void (props[k] = v) },
      classList: { toggle: (c: string, on: boolean) => void (on ? classes.add(c) : classes.delete(c)) },
    } as unknown as HTMLElement,
  };
}

describe("text settings (GDD §10)", () => {
  it("scales text within limits and toggles the readable font", () => {
    const r = fakeRoot();
    applyTextSettings({ textScale: 1.3, readableFont: true }, r.el);
    expect(r.props["--text-scale"]).toBe("1.3");
    expect(r.classes.has("readable")).toBe(true);
    applyTextSettings({ textScale: 9, readableFont: false }, r.el);
    expect(r.props["--text-scale"]).toBe("1.6");
    expect(r.classes.has("readable")).toBe(false);
    applyTextSettings({ textScale: Number.NaN, readableFont: false }, r.el);
    expect(r.props["--text-scale"]).toBe("1");
  });
});
