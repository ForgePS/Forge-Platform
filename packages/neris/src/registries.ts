import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to shipped NERIS registry JSON files. */
export function getNerisRegistriesDir(): string {
  // dist/ -> package root/registries
  return join(__dirname, "..", "registries");
}

export function loadFieldRegistryJson(registriesDir = getNerisRegistriesDir()): unknown {
  return JSON.parse(readFileSync(join(registriesDir, "neris_field_registry.json"), "utf8"));
}

export function loadValueSetsJson(registriesDir = getNerisRegistriesDir()): unknown {
  return JSON.parse(readFileSync(join(registriesDir, "neris_value_sets.json"), "utf8"));
}

export function checksumRegistryFiles(registriesDir = getNerisRegistriesDir()): string {
  const fields = readFileSync(join(registriesDir, "neris_field_registry.json"));
  const values = readFileSync(join(registriesDir, "neris_value_sets.json"));
  return createHash("sha256").update(fields).update(values).digest("hex");
}

export const NERIS_EXPECTED_COUNTS = {
  modules: 39,
  fields: 682,
  valueSets: 147,
  options: 1537,
} as const;
