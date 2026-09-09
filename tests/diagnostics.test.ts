import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validatePage } from "../src/index";
import { serializeDiagnostics } from "../src/diagnostics";
import { PROFILE_ID } from "../src/profile";

const root = join(import.meta.dir, "..");
const load = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

describe("diagnostics serialization", () => {
  test("deterministic diagnostic JSON", () => {
    const m = load("fixtures/overflow.json");
    const a = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    const b = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(serializeDiagnostics(a)).toBe(serializeDiagnostics(b));
    expect(serializeDiagnostics(a).endsWith("\n")).toBe(true);
  });
});
