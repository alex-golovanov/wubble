import { describe, expect, test } from "bun:test";
import { parseRenderConfig } from "../src/config";

describe("project config", () => {
  test("reads house rules and font bindings", () => {
    const { config, errors } = parseRenderConfig({
      id: "example-house-rules",
      fonts: { dialogue: "shantell-sans-semibold", notice: "oswald-medium" },
      styles: { notice: { label: "required", tail: "forbidden", labelBrackets: true } },
    });
    expect(errors).toEqual([]);
    expect(config.fonts?.dialogue).toBe("shantell-sans-semibold");
    expect(config.styles?.notice?.label).toBe("required");
    expect(config.styles?.notice?.labelBrackets).toBe(true);
  });

  test("names what it cannot use instead of silently ignoring it", () => {
    const { errors } = parseRenderConfig({
      fonts: { machine: "oswald-medium", notice: "not-a-font" },
      styles: { robot: {}, notice: { label: "sometimes" } },
    });
    expect(errors.some((e) => e.includes('font role "machine"'))).toBe(true);
    expect(errors.some((e) => e.includes("registered font id"))).toBe(true);
    expect(errors.some((e) => e.includes('style "robot"'))).toBe(true);
    expect(errors.some((e) => e.includes("notice.label"))).toBe(true);
  });

  test("an empty config is valid and changes nothing", () => {
    const { config, errors } = parseRenderConfig({});
    expect(errors).toEqual([]);
    expect(config.fonts).toBeUndefined();
    expect(config.styles).toBeUndefined();
  });
});
