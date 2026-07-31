export type TableDefinition = {
  id: string;
  title: string;
  description?: string;
  featureFlag: string;
  route?: string;
};

const registry = new Map<string, TableDefinition>();

export function registerTable(def: TableDefinition): void {
  if (registry.has(def.id)) {
    throw new Error(`Table already registered: ${def.id}`);
  }
  registry.set(def.id, def);
}

export function getTable(id: string): TableDefinition | undefined {
  return registry.get(id);
}

export function listTables(): TableDefinition[] {
  return Array.from(registry.values());
}

export function clearTableRegistryForTests(): void {
  registry.clear();
}
