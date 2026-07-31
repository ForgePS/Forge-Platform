# NERIS Phase 4B — Increment Report

**Date:** 2026-07-27  
**Increment:** 4B — Secure webhook intake, queues, normalization, idempotency, DLQ  
**Decision:** COMPLETE (code) — **not deployed**; migrations not applied to Aurora yet

## Completed

- `@forge/cad-adapters` with `forge.synthetic` adapter (HMAC auth, parse, normalize)
- Webhook HMAC helpers + unit tests in `@forge/cad-core`
- Nest `CadModule` — `POST /api/v1/cad/webhooks/:connectionPublicId` (`@Public`, flag-gated)
- Raw persist (S3 or local inline), idempotency key, replay cache, audit (no payload in logs)
- SQS enqueue to `cad-intake` after persist; ACK `202 ACCEPTED|DUPLICATE`
- Migration `0016_cad_webhook_lookup` — SECURITY DEFINER public_id lookup (ADR-029)
- CDK: `cad-intake`, `cad-normalization`, `cad-matching`, `cad-application` (+ DLQs), IAM, env wiring
- Worker `CadIntakeSqsConsumer` + normalization to `cad_normalized_events`
- Architecture note: `docs/neris/architecture/cad-webhook-security.md`

## Deferred

- Full matching/application workers (4C)
- Secret rotation API / multi-key grace runtime beyond SM JSON `keys` map
- Polling framework runtime (4E)
- Deploy + Cognito acceptance (4F)
- Connection CRUD APIs (4D starts UI; manage APIs may land earlier in 4C)

## Risks

- Webhook path untested against live Aurora until migrate + deploy
- S3 PutObject requires KMS permissions already granted via documents bucket
- Local overrides env must never ship to production tasks

## Verification

```text
pnpm install
pnpm --filter @forge/cad-core test
pnpm --filter @forge/cad-adapters test
pnpm --filter @forge/cad-contracts build
pnpm --filter @forge/cad-core build
pnpm --filter @forge/cad-adapters build
pnpm --filter @forge/platform-api typecheck
pnpm --filter @forge/worker-service typecheck
pnpm --filter @forge/infrastructure-cdk test
```
