# Import Rollback Execution

The import platform persists rollback journal entries in `import_execution_journal` and classifies them as:

- FULLY_REVERSIBLE
- COMPENSATING_ACTION
- MANUAL_REVIEW_REQUIRED
- NOT_REVERSIBLE

`POST .../rollback-request` still performs the safety classification first.

- `NOT_REVERSIBLE` is refused and never queued.
- approved rollback requests transition to `ROLLBACK_PENDING`, create a rollback event, and enqueue a versioned `IMPORT_ROLLBACK` message.
- the worker validates tenant/job/event identity and replays execution journal entries in reverse commit order.
- each journal entry resolves its original adapter and calls `compensateRecord`.
- entries classified `NOT_REVERSIBLE` or `MANUAL_REVIEW_REQUIRED` are not automatically compensated.
- the job becomes `ROLLED_BACK` only when all required compensation succeeds.
- incomplete compensation leaves the job in `ROLLBACK_PENDING` with current stage `ROLLBACK_FAILED` and records failure details on the rollback event.

Product adapters remain responsible for safe compensation semantics. The RMS hydrant adapter removes imported damage reports, inspections, flow tests, and then the imported hydrant inside a tenant-scoped transaction.

## Operational requirement

Before production enablement, run dependency-backed worker/API tests and an authenticated database rehearsal covering execution, duplicate rerun, rollback, rollback retry/idempotency, and cross-tenant denial.
