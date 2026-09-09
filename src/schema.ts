import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PageManifest } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(ROOT, "schemas/page.schema.json");

const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateSchema: false,
});
addFormats(ajv);

const validateFn = ajv.compile(schema);

export interface SchemaResult {
  ok: boolean;
  errors: string[];
  manifest: PageManifest | null;
}

/** Strip non-contract keys (e.g. $schema) before validation */
function prepare(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const obj = { ...(input as Record<string, unknown>) };
  delete obj.$schema;
  return obj;
}

export function validateSchema(input: unknown): SchemaResult {
  const prepared = prepare(input);
  const ok = validateFn(prepared);
  if (!ok) {
    const errors = (validateFn.errors ?? []).map((e) => {
      const path = e.instancePath || "/";
      return `${path} ${e.message ?? "invalid"}`.trim();
    });
    return { ok: false, errors, manifest: null };
  }
  return { ok: true, errors: [], manifest: prepared as PageManifest };
}
