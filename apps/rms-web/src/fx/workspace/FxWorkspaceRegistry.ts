import type { WorkspaceDefinition } from "./types";

const registry = new Map<string, WorkspaceDefinition>();

export function registerWorkspace(def: WorkspaceDefinition): void {
  if (registry.has(def.id)) {
    throw new Error(`Workspace already registered: ${def.id}`);
  }
  registry.set(def.id, def);
}

export function getWorkspace(id: string): WorkspaceDefinition | undefined {
  return registry.get(id);
}

export function listWorkspaces(): WorkspaceDefinition[] {
  return Array.from(registry.values());
}

export function clearWorkspaceRegistryForTests(): void {
  registry.clear();
}
