# NERIS Phase 4A — Increment Report

**Date:** 2026-07-27  
**Increment:** 4A — CAD core contracts, schema, flags, permissions, audit types  
**Decision:** COMPLETE (local verification pending deploy) — **not** Phase 4 accepted

## Completed

- Packages: `@forge/cad-contracts`, `@forge/cad-core`
- Adapter contract + enums + Zod schemas + audit action constants + feature flag keys + permissions
- Matching / ownership / idempotency / out-of-order helpers in `@forge/cad-core` with unit tests
- Migrations `0013_cad_connections`, `0014_cad_messages_and_events`, `0015_cad_mapping` with FORCE RLS
- Drizzle schema `packages/database/src/schema/cad.ts` + tenant CAD config columns
- Seed feature flags (`rms.cad.*`, `platform.cad.adapter_management.enabled`) default **false**
- Permissions seeded via `RMS_PERMISSIONS` / `PLATFORM_PERMISSIONS`; raw payload excluded from department admin template; creator-only CAD platform perms
- Domain event types for CAD in `@forge/events`
- Prefill source `CAD` added (kept `FUTURE_CAD` for compatibility)
- Feature-flags doc updated

## Deferred (later increments)

- Webhook intake, queues, workers (4B)
- Incident matching application, links, conflicts tables (4C / migrations 0016+)
- Ops UI / Creator UI (4D)
- Simulator package, polling runtime, alarms (4E)
- AWS deploy + Cognito acceptance (4F)

## Risks

- Migrations not yet applied to development Aurora (deferred to 4F / explicit migrate)
- No API module yet — contracts/schema only
- Mapping profiles created in 0013 ahead of rules in 0015 (intentional FK order)

## Verification (this increment)

Run locally:

```text
pnpm install
pnpm --filter @forge/cad-contracts test
pnpm --filter @forge/cad-core test
pnpm --filter @forge/cad-contracts typecheck
pnpm --filter @forge/cad-core typecheck
pnpm --filter @forge/contracts typecheck
pnpm --filter @forge/database typecheck
pnpm --filter @forge/events typecheck
```
