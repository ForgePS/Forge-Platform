# ADR-031 — NERIS incident field storage (typed EAV)

- **Status:** Accepted
- **Date:** 2026-07-26
- **Sprint / Phase:** NERIS Phase 2 — Core Incident Shell

## Context

NERIS incidents contain hundreds of registry-defined fields across multiple sections, including repeatable groups. Storing the entire report as an opaque JSON blob would make validation, audit, prefill tracking, and partial updates difficult. Phase 1 already provides a normalized schema registry (`neris_fields`, `neris_value_options`, conditions, overlays).

## Decision

1. Persist incident answers in `neris_incident_field_values` keyed by `(incident_id, field_id, section_key, repeatable_item_id?)`.
2. Use typed columns — `value_text`, `value_number`, `value_boolean`, `value_timestamp`, `value_option_id`, `value_json` — rather than a single untyped text column.
3. Track provenance with `prefill_source` and `user_confirmed`; user-confirmed values are never silently overwritten.
4. Support repeatable groups via `neris_incident_repeatable_groups` and `neris_incident_repeatable_items`.
5. Reject blob-only storage as the primary model; structured JSON snapshots are additive (schema/configuration snapshots), not a substitute for queryable field rows.

## Consequences

- Field-level validation, audit, and duplicate detection can reference stable registry IDs.
- Batch PATCH of field values maps cleanly to upsert semantics per section.
- Repeatable-card UI maps to explicit item rows instead of nested JSON parsing in the API.
- Migration `0010_neris_incident_shell` and RLS policies apply to all field-value tables.

## References

- Migration: `packages/database/drizzle/0010_neris_incident_shell.sql`
- Schema: `packages/database/src/schema/neris-incidents.ts`
