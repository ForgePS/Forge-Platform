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

The production worker now registers `FORGE_RMS:HYDRANTS:hydrant@1` in its default adapter registry, and the Platform API automatically selects that adapter for the exact `FORGE_RMS / HYDRANTS / hydrant` import tuple.

Execution behavior:

- creates the tenant-scoped hydrant and valid historical child rows in one transaction
- skips an existing tenant/display-ID match as a duplicate instead of overwriting it
- records destination ID and compensation metadata in the generic import journal
- preserves valid flow-test, inspection, and damage-report timestamps where supplied
- supports injected registries in worker tests, so the shared execution engine remains independently testable

The adapter implements `compensateRecord` by deleting imported damage reports, inspections, flow tests, then the imported hydrant inside a tenant transaction.

### Remaining rollback boundary

The shared Import Platform currently implements rollback request/classification and stores rollback journal entries, but generic compensation execution is still deferred. Therefore hydrant rollback capability exists at the adapter level but must not be described as end-to-end operational until the rollback worker invokes `compensateRecord` and completes the job state transition to `ROLLED_BACK`.

### Required production validation

Before production migration:

1. run worker-service typecheck/unit tests
2. run platform-api import tests
3. execute an authenticated staged hydrant import against an isolated tenant
4. verify rerun duplicate/idempotency behavior
5. verify historical child counts and latest hydrant snapshots
6. execute rollback after generic compensation execution is wired
