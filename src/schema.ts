import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PageManifest } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(ROOT, "schemas/page.schema.json");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function loadSchemaObject(): object {
  const raw: unknown = JSON.parse(readFileSync(schemaPath, "utf8"));
  if (!isPlainObject(raw)) {
    throw new Error(`Schema at ${schemaPath} must be a JSON object`);
  }
  return raw;
}

const schema = loadSchemaObject();

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
  if (!isPlainObject(input)) {
    return input;
  }
  const obj: Record<string, unknown> = { ...input };
  delete obj["$schema"];
  return obj;
}

/** Structural gate after AJV success — avoids type assertions. */
function isPageManifest(value: unknown): value is PageManifest {
  if (!isPlainObject(value)) return false;
  if (value["schemaVersion"] !== "0.1.0") return false;
  if (typeof value["pageId"] !== "string") return false;
  if (!isPlainObject(value["coordinateSpace"])) return false;
  if (!isPlainObject(value["renderProfile"])) return false;
  if (!Array.isArray(value["subjects"])) return false;
  if (!Array.isArray(value["exclusionZones"])) return false;
  if (!Array.isArray(value["items"])) return false;
  return true;
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
  if (!isPageManifest(prepared)) {
    return {
      ok: false,
      errors: ["validated JSON failed PageManifest structural check"],
      manifest: null,
    };
  }
  return { ok: true, errors: [], manifest: prepared };
}
