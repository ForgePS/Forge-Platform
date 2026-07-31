# NERIS Phase 4C — Increment Report

**Date:** 2026-07-27  
**Increment:** 4C — Matching, links, intake modes, provenance, ownership, conflicts  
**Decision:** COMPLETE (code) — **not deployed**

## Completed

- Migration `0017_cad_incident_links_and_conflicts` — links, conflicts, field provenance, manual fallback sessions + FORCE RLS
- Drizzle schema for 4C tables
- `@forge/cad-core` `evaluateCadMatch` (deterministic scoring) + unit tests
- Worker `CadMatchSqsConsumer` — match → create/update/link/conflict → apply CAD values with ownership + provenance
- Nest APIs: conflict list/get/resolve/escalate; incident CAD link/unlink
- MANUAL_ONLY / CAD_ENABLED / HYBRID intake gating on manual incident create (respects `allow_manual_creation_when_cad_enabled`, fallback sessions, manual override permission/reason)
- Incident `operatingMode` now taken from tenant configuration (not hard-coded MANUAL_ONLY)

## Deferred

- Full unit/personnel unknown queues (migration 0018 / UI in 4D)
- Manual fallback start/end APIs (table ready; UI/API polish in 4D/4E)
- Cad-suspend / cad-resume endpoints
- Deploy + Cognito scenarios (4F)

## Risks

- CAD create path uses simplified numbering claim in worker (mirrors Nest service; keep in sync)
- Matching candidate window is 2 hours / 50 recent incidents — tune after synthetic load
- Address/location matching uses normalized contains, not fuzzy ML

## Verification

```text
pnpm --filter @forge/cad-core test
pnpm --filter @forge/cad-core build
pnpm --filter @forge/database build
pnpm --filter @forge/platform-api typecheck
pnpm --filter @forge/worker-service typecheck
pnpm --filter @forge/platform-api lint
pnpm --filter @forge/worker-service lint
```
