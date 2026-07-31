# NERIS Phase 4E — Increment Report

**Date:** 2026-07-27  
**Status:** COMPLETE (code) — **not deployed**  
**Phase 5:** NOT AUTHORIZED

## Scope delivered

### Packages

- `@forge/cad-simulator` — scenario catalog, payload builders, HMAC webhook signing helpers (+ unit tests)

### Database

- Migration `0019_cad_operations_and_retention` — connection outages, health logs, retention run audit (FORCE RLS)

### Adapter / contracts

- Optional `pollMessages` on `CadAdapter`
- Synthetic adapter implements polling (synthetic incident/heartbeat generation)

### API

- Simulator: scenarios, send (`WEBHOOK` | `DIRECT_QUEUE`), outage, recover, list outages
- Message reprocess + batch replay (audited; no raw payload returned)

### Worker

- `cad-polling` consumer/processor (tenant allowlist via `CAD_POLLING_TENANT_IDS`)
- `cad-retention` consumer/processor (replay cache + expired inline payload purge; audited)
- EMF metrics for polling/retention

### CDK

- `cad-polling` / `cad-retention` queues + DLQs
- EventBridge schedules (1-minute polling tick; daily retention)
- Worker/API env + IAM wiring
- CAD DLQ CloudWatch alarms

### Ops docs

- [cad-operations-runbook.md](../operations/cad-operations-runbook.md)

## Explicitly not in 4E

- AWS deploy / Cognito `@phase4` scenarios (4F)
- Creator Console simulator UI
- S3 lifecycle deletion of archived raw objects (metadata purge only for inline)
- Cross-tenant SECURITY DEFINER polling discovery (uses env allowlist)

## Verification

- `@forge/cad-simulator` tests (2) pass
- platform-api + worker-service typecheck + lint
- cad-contracts / cad-core / cad-adapters / database / environment builds

## Deploy notes

Migrations `0013`–`0019` exist in repo only until ECS migrate. Flags remain default **false**.
