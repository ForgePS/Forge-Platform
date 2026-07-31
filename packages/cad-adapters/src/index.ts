import type { CadAdapter } from "@forge/cad-contracts";
import { FORGE_SYNTHETIC_ADAPTER_KEY, ForgeSyntheticCadAdapter } from "./synthetic-adapter.js";

const adapters = new Map<string, CadAdapter>();

export function registerCadAdapter(adapter: CadAdapter): void {
  adapters.set(adapter.manifest.adapterKey, adapter);
}

export function getCadAdapter(adapterKey: string): CadAdapter | undefined {
  return adapters.get(adapterKey);
}

export function listCadAdapters(): CadAdapter[] {
  return [...adapters.values()];
}

export function registerBuiltInCadAdapters(): void {
  if (!adapters.has(FORGE_SYNTHETIC_ADAPTER_KEY)) {
    registerCadAdapter(new ForgeSyntheticCadAdapter());
  }
}

registerBuiltInCadAdapters();

export * from "./synthetic-adapter.js";
