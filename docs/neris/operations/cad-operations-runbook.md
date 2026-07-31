# CAD operations runbook (Phase 4E)

**Environment:** development AWS account only  
**Phase 5:** NOT AUTHORIZED

## Flags

Enable only on synthetic tenant A:

- `rms.cad.enabled`
- `rms.cad.webhook.enabled` and/or `rms.cad.polling.enabled`
- `rms.cad.operations.enabled`
- `rms.cad.simulator.enabled` (simulator APIs)

Worker schedule tenants (comma-separated UUIDs):

- `CAD_POLLING_TENANT_IDS`
- `CAD_RETENTION_TENANT_IDS`

Local webhook secrets (never production):

- `CAD_WEBHOOK_SECRET_OVERRIDES_JSON` = `{ "<connectionPublicId>": "<secret>" }`

## Simulator

1. Create a DEVELOPMENT connection (`forge.synthetic`, `HTTPS_WEBHOOK` or `POLLING`).
2. Enable connection after test.
3. `GET /api/v1/tenants/:id/cad/simulator/scenarios`
4. `POST .../cad/simulator/send` with `delivery: "DIRECT_QUEUE"` (no secret) or `WEBHOOK` (requires override secret).
5. `POST .../cad/simulator/outage` / `recover` to exercise degraded mode.

## Polling

- EventBridge rule every 1 minute enqueues `cad.polling.tick.v1` to `cad-polling` SQS.
- Worker polls ACTIVE/TESTING/DEGRADED connections with transport `POLLING` or `SYNTHETIC_SIMULATOR`.
- Messages persist as raw CAD rows (metadata + inline payload locally) then enqueue intake.

## Retention

- Daily EventBridge cron enqueues `cad.retention.run.v1`.
- Worker purges expired webhook replay cache and clears expired inline payloads.
- Each run writes `cad_retention_runs` audit metadata (no raw payload content).

## Replay / reprocess

- `POST .../cad/messages/:id/reprocess` — re-enqueue one message to intake (audited).
- `POST .../cad/messages/replay` — batch reprocess (audited CRITICAL).

## Alarms

CloudWatch alarms fire when CAD DLQ visible message count ≥ 1:

- cad-intake, cad-normalization, cad-matching, cad-application, cad-polling, cad-retention

EMF metrics (worker stdout): `CadPolling*`, `CadRetention*`.

## Emergency stop

1. Disable CAD feature flags.
2. Disable all CAD connections.
3. Clear `CAD_POLLING_TENANT_IDS` / `CAD_RETENTION_TENANT_IDS`.
4. Do not rotate/replace `forge-development-secrets-database-app`.
