import { z } from "zod";

export const nerisFieldSchema = z
  .object({
    name: z.string().min(1),
    group: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    value_set: z.union([z.boolean(), z.string()]).nullable().optional(),
    value_set_location: z.string().nullable().optional(),
    format: z.string().nullable().optional(),
    possible_if: z.string().nullable().optional(),
    db_required: z.union([z.boolean(), z.string()]).nullable().optional(),
    neris_core: z.union([z.boolean(), z.string()]).nullable().optional(),
    neris_core_if: z.string().nullable().optional(),
    neris_core_aid: z.union([z.boolean(), z.string()]).nullable().optional(),
    computed: z.union([z.boolean(), z.string()]).nullable().optional(),
    computed_from: z.string().nullable().optional(),
    cardinality: z.string().nullable().optional(),
    map_orm_landing: z.string().nullable().optional(),
    map_app: z.string().nullable().optional(),
    definition: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    example: z.unknown().optional(),
    comments: z.string().nullable().optional(),
    ordinal: z.number().int().optional(),
    value_set_candidates: z.array(z.string()).optional(),
  })
  .passthrough();

export const nerisModuleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  area: z.string().nullable().optional(),
  source_workbook: z.string().nullable().optional(),
  field_count: z.number().int().optional(),
  groups: z
    .array(
      z.object({
        key: z.string().min(1),
        field_names: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  fields: z.array(nerisFieldSchema),
});

export const nerisFieldRegistrySchema = z.object({
  metadata: z.record(z.unknown()).optional(),
  modules: z.array(nerisModuleSchema),
});

export const nerisValueOptionSchema = z
  .object({
    value: z.string().min(1),
    active: z.boolean().optional(),
    description: z.string().nullable().optional(),
    definition: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    ordinal: z.number().int().optional(),
    value_1: z.string().nullable().optional(),
    value_2: z.string().nullable().optional(),
    value_3: z.string().nullable().optional(),
    description_1: z.string().nullable().optional(),
    description_2: z.string().nullable().optional(),
    description_3: z.string().nullable().optional(),
  })
  .passthrough();

export const nerisValueSetSchema = z.object({
  source_key: z.string().min(1),
  name: z.string().min(1),
  source_workbook: z.string().nullable().optional(),
  option_count: z.number().int().optional(),
  options: z.array(nerisValueOptionSchema),
});

export const nerisValueSetsRegistrySchema = z.object({
  metadata: z.record(z.unknown()).optional(),
  value_sets: z.array(nerisValueSetSchema),
});

export type NerisFieldRegistry = z.infer<typeof nerisFieldRegistrySchema>;
export type NerisValueSetsRegistry = z.infer<typeof nerisValueSetsRegistrySchema>;
export type NerisModule = z.infer<typeof nerisModuleSchema>;
export type NerisField = z.infer<typeof nerisFieldSchema>;
export type NerisValueSet = z.infer<typeof nerisValueSetSchema>;
export type NerisValueOption = z.infer<typeof nerisValueOptionSchema>;

export function parseFieldRegistry(input: unknown): NerisFieldRegistry {
  return nerisFieldRegistrySchema.parse(input);
}

export function parseValueSetsRegistry(input: unknown): NerisValueSetsRegistry {
  return nerisValueSetsRegistrySchema.parse(input);
}

/** Build hierarchy edges from value_1 / value_2 / value_3 levels. */
export function buildHierarchyEdges(
  options: NerisValueOption[],
): Array<{ parentCode: string; childCode: string; level: number }> {
  const edges: Array<{ parentCode: string; childCode: string; level: number }> = [];
  const seen = new Set<string>();

  for (const option of options) {
    const levels = [option.value_1, option.value_2, option.value_3].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0,
    );
    for (let i = 0; i < levels.length - 1; i += 1) {
      const parentCode = levels[i]!;
      const childCode = levels[i + 1]!;
      const key = `${parentCode}=>${childCode}@${i + 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ parentCode, childCode, level: i + 1 });
    }
  }
  return edges;
}
