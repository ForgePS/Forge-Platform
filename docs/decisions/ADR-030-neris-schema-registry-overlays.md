# ADR-030 — NERIS Schema Registry and Tenant Overlays

- **Status:** Accepted
- **Date:** 2026-07-26
- **Sprint / Phase:** NERIS Phase 1 Schema Foundation

## Context

Forge RMS must report against the official NERIS V1 Core and Secondary schemas (39 modules, 682 fields, 147 value-set tables, 1,537 options). Several value-set table names collide across workbooks. Tenant administrators need local UX configuration without corrupting official codes.

## Decision

1. Store official schema as a versioned platform catalog (`neris_*` tables) keyed by package + checksum.
2. Identify value sets by namespaced `source_key` (e.g. `incident_type_files.type_gender`), never by bare name alone.
3. Keep official field keys, option codes, cardinality, payload mappings, and schema conditions immutable after publish.
4. Allow tenant configuration only through overlay tables (`tenant_neris_*`) for labels, help, favorites, aliases, ordering, optional visibility, safe defaults, and additional local validation.
5. Convert `possible_if` / conditional-required expressions into a structured rule tree evaluated without `eval` or dynamic code. Unparseable prose is stored as `NEEDS_REVIEW`.
6. Gate unfinished Creator schema browsers with `rms.neris.schema_browser.enabled` (default false). Platform admins may bypass for support.

## Consequences

- Incident forms (Phase 2+) render from the registry and overlays.
- Schema upgrades import as new versions; historical option codes remain readable.
- MANUAL_ONLY / CAD_ENABLED / HYBRID operating modes live on tenant configuration for later intake work; Phase 1 does not implement CAD or intake.
