# RMS Hydrant Migration Contract

## Purpose

Migrate legacy Forge Responder, Firestore, CSV/XLSX, JSON, ZIP, or API hydrant data into the tenant-scoped Forge Platform hydrant domain without guessing identity or losing operational history.

## Import template

- Template: `rms.hydrants.v1`
- Product: `FORGE_RMS`
- Module: `HYDRANTS`
- Record category: `hydrant`
- Future execution adapter key: `FORGE_RMS:HYDRANTS:hydrant@1`

The shared import engine remains the system of record for upload security, staging, mappings, row errors, duplicate review, preview, approval, execution status, idempotency, and rollback journals.

## Source normalization

`hydrant-import.ts` normalizes common legacy field variants including:

- Firestore/Responder camelCase
- snake_case exports
- common hydrant number / ID aliases
- `lat/lng/lon/long`
- GPM and pressure aliases
- operational status variants
- nested `flowTests`, `inspections`, and `damageReports`

Every source row receives:

- stable `sourceRowKey`
- SHA-256 `sourceHash`
- normalized target record
- row issues
- classification: `READY` or `INVALID`

## Validation rules

The normalizer never fabricates missing location data.

Blocking examples:

- latitude without longitude
- longitude without latitude
- out-of-range coordinates
- invalid numeric values
- missing source/display identity after normalization

Warnings include:

- no street address and no coordinates
- unknown/unmappable operational status

## Duplicate and ambiguity rules

Duplicate candidates are checked in this order:

1. case-insensitive display ID
2. official hydrant ID
3. location ID
4. GIS proximity within 25 feet

One match is classified `DUPLICATE`.

More than one candidate is classified `AMBIGUOUS` and requires human resolution. The migration layer must never select one automatically.

No candidate is `READY`.

## Reconciliation gate

Before execution, produce counts for:

- total
- ready
- invalid
- duplicate
- ambiguous
- warnings

Execution must not be treated as approved while any ambiguous row remains unresolved.

## Historical child records

A production adapter must create the hydrant master record first, then preserve source history as child records:

- flow tests
- inspections
- damage reports

Historical timestamps and source values must be preserved. Current hydrant GPM/pressure/status snapshots should be derived from the newest successfully imported history or explicit master snapshot according to deterministic adapter rules.

## Provenance

Do not overload operational IDs with migration metadata. Preserve migration provenance through the import engine:

- import job
- staged row
- source row key
- source hash
- destination record ID
- execution journal
- audit/outbox events

## Execution status

As of this change, Forge Platform's S8 import execution service explicitly defaults to the neutral reference adapter and states that product adapters are not authorized in the worker path.

Therefore this work intentionally enables:

- template selection
- normalization
- validation
- duplicate/ambiguity classification
- reconciliation/preview design

It does **not** claim that live hydrant commits through the generic import worker are enabled.

The next execution step is to register a database-backed `FORGE_RMS:HYDRANTS:hydrant@1` adapter in the worker/runtime, then add rollback/compensation and authenticated end-to-end migration tests.
