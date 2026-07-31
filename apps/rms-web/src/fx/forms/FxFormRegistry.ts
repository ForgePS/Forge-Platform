export type FormDefinition = {
  id: string;
  title: string;
  description?: string;
  featureFlag: string;
  route?: string;
};

const registry = new Map<string, FormDefinition>();

export function registerForm(def: FormDefinition): void {
  if (registry.has(def.id)) {
    throw new Error(`Form already registered: ${def.id}`);
  }
  registry.set(def.id, def);
}

export function getForm(id: string): FormDefinition | undefined {
  return registry.get(id);
}

export function listForms(): FormDefinition[] {
  return Array.from(registry.values());
}

export function clearFormRegistryForTests(): void {
  registry.clear();
}
