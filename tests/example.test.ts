import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSchema } from "../src/schema";
import { renderPage, validatePage } from "../src/index";
import { PROFILE_ID, loadFontBytes, PROFILE } from "../src/profile";
import { createHash } from "node:crypto";

const root = join(import.meta.dir, "..");

describe("example page-022", () => {
  test("validates against bundled schema 0.1.0", () => {
    const m = JSON.parse(
      readFileSync(join(root, "examples/page-022.json"), "utf8"),
    );
    const r = validateSchema(m);
    expect(r.ok).toBe(true);
    expect(r.manifest?.schemaVersion).toBe("0.1.0");
  });

  test("font digest matches profile", () => {
    const bytes = loadFontBytes();
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(digest).toBe(PROFILE.typography.fontDigestSha256);
  });

  test("smoke: en render succeeds", () => {
    const m = JSON.parse(
      readFileSync(join(root, "examples/page-022.json"), "utf8"),
    );
    const v = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(v.valid).toBe(true);
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.svg?.startsWith("<?xml")).toBe(true);
  });
});
