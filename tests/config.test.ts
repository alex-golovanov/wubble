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

  test("reads a register's line weight", () => {
    const { config, errors } = parseRenderConfig({ styles: { dialogue: { strokeWidth: 6 } } });
    expect(errors).toEqual([]);
    expect(config.styles?.dialogue?.strokeWidth).toBe(6);
  });

  test("refuses a line weight that is not a positive number", () => {
    const zero = parseRenderConfig({ styles: { dialogue: { strokeWidth: 0 } } });
    const word = parseRenderConfig({ styles: { caption: { strokeWidth: "thin" } } });
    expect(zero.errors.some((e) => e.includes("dialogue.strokeWidth"))).toBe(true);
    expect(word.errors.some((e) => e.includes("caption.strokeWidth"))).toBe(true);
  });

  test("reads a register's body and fill", () => {
    const { config, errors } = parseRenderConfig({
      styles: { dialogue: { body: "drawn", fill: "#ffffff" } },
    });
    expect(errors).toEqual([]);
    expect(config.styles?.dialogue?.body).toBe("drawn");
    expect(config.styles?.dialogue?.fill).toBe("#ffffff");
  });

  test("refuses an unknown body and a fill that is not a colour", () => {
    const { errors } = parseRenderConfig({
      styles: { dialogue: { body: "blob", fill: "white" } },
    });
    expect(errors.some((e) => e.includes("dialogue.body"))).toBe(true);
    expect(errors.some((e) => e.includes("dialogue.fill"))).toBe(true);
  });

  test("an empty config is valid and changes nothing", () => {
    const { config, errors } = parseRenderConfig({});
    expect(errors).toEqual([]);
    expect(config.fonts).toBeUndefined();
    expect(config.styles).toBeUndefined();
  });
});
