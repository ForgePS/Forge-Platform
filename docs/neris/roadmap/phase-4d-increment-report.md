# NERIS Phase 4D — Increment Report

**Date:** 2026-07-27  
**Status:** COMPLETE (code) — **not deployed**  
**Phase 5:** NOT AUTHORIZED

## Scope delivered

Operations and configuration surfaces for CAD (feature-gated), plus incident CAD status panel.

### Database

- Migration `0018_cad_unit_personnel_mapping` — unit/personnel mappings and unknown-entity queues with FORCE RLS
- Drizzle schema: `cadUnitMappings`, `cadUnknownUnits`, `cadPersonnelMappings`, `cadUnknownPersonnel`

### API (`apps/platform-api` CadModule)

- Connections: list/get/create/patch, enable/disable, test, rotate-secret (metadata only; secret values never returned)
- Operations summary (requires `rms.cad.operations.enabled`)
- Message metadata list (no raw payload)
- Unmapped values list/resolve
- Unknown unit/personnel list/resolve (creates mapping rows when status=`MAPPED`)
- Unit/personnel mapping lists
- Incident `cad-status` aggregate (links + open conflicts)

PRODUCTION connections remain blocked for create/enable in Phase 4 development.

### RMS Web

- Feature flags: `cadEnabled`, `cadOperations`, `cadHybrid`
- Nav groups: Operations + Configuration CAD links
- Pages: `/cad/operations/`, `/cad/connections/`, `/cad/conflicts/`, `/cad/unmapped/`, `/cad/mappings/`, `/cad/messages/`
- Incident workspace CAD status panel (links + conflict entry)

## Explicitly not in 4D

- Simulator package / polling runtime (4E)
- CloudWatch alarms / retention jobs (4E)
- AWS deploy / Cognito `@phase4` scenarios (4F)
- Creator Console adapter templates
- Raw payload viewing UI

## Verification

- `@forge/database` build
- `@forge/platform-api` typecheck + lint
- `@forge/rms-web` typecheck

## Deploy notes

Migrations `0013`–`0018` exist in repo only until ECS migrate. CAD flags remain default **false**.
