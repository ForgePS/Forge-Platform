import { describe, expect, it } from "vitest";
import { NERIS_EXPECTED_COUNTS, buildHierarchyEdges, parseValueSetsRegistry } from "./index.js";

describe("registry helpers", () => {
  it("exposes expected Phase 1 counts", () => {
    expect(NERIS_EXPECTED_COUNTS).toEqual({
      modules: 39,
      fields: 682,
      valueSets: 147,
      options: 1537,
    });
  });

  it("builds hierarchy edges from value_1/2/3", () => {
    const edges = buildHierarchyEdges([
      {
        value: "FIRE: STRUCTURE_FIRE: ROOM",
        value_1: "FIRE",
        value_2: "STRUCTURE_FIRE",
        value_3: "ROOM",
        active: true,
        ordinal: 1,
      },
    ]);
    expect(edges).toEqual([
      { parentCode: "FIRE", childCode: "STRUCTURE_FIRE", level: 1 },
      { parentCode: "STRUCTURE_FIRE", childCode: "ROOM", level: 2 },
    ]);
  });

  it("keeps namespaced source keys distinct", () => {
    const parsed = parseValueSetsRegistry({
      value_sets: [
        {
          source_key: "incident_type_files.type_gender",
          name: "type_gender",
          options: [{ value: "MALE", active: true, ordinal: 1 }],
        },
        {
          source_key: "health_and_safety_type_files.type_gender",
          name: "type_gender",
          options: [{ value: "MALE", active: true, ordinal: 1 }],
        },
      ],
    });
    expect(parsed.value_sets).toHaveLength(2);
    expect(new Set(parsed.value_sets.map((set) => set.source_key)).size).toBe(2);
  });
});
