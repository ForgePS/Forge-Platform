# NERIS Phase 1 — Schema Foundation Plan

See execution plan in Cursor plans. Source package registries live in `packages/neris/registries/`.

## Acceptance checklist

- [x] Migration `0007_neris_schema_foundation` (+ `0008` field ordinal unique) local + development
- [x] Idempotent `pnpm neris:import-schema` (39/682/147/1537)
- [x] Integrity + RLS + unit + API tests green
- [x] Creator schema browsers behind feature flag
- [x] Lint / typecheck / build green
- [x] Completion report written (`NERIS-PHASE-1-summary.md`)
- [x] Aurora migrate + import verified
