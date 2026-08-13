# Wave C — Creator authenticated UAT

Environment: DEVELOPMENT (`https://creator-dev.forgepublicsafety.com`)  
Release base: `aedf54a8348a621d718ec7d2fa47456c1953032b`  
Evidence date: 2026-08-13  
Credentials: Forge internal DEVELOPMENT UAT Cognito identity (not recorded)

## Preflight WIP preserved

- Unrelated analytics/API worktrees left uncommitted (see Wave C checkpoint).

## Cases

| Case | Result | Notes |
|------|--------|-------|
| LOGIN | PASS / CONDITION | Cognito Hosted UI path covered by `configuration-e2e` smoke when `E2E_COGNITO_*` set |
| DASHBOARD | PASS | `/` uses Forge page chrome |
| CUSTOMERS | PASS | `/tenants` labeled Customers in nav |
| CUSTOMER DETAIL | PASS | Tabbed workspace + live APIs; unavailable fields show Not available |
| PRODUCTS & MODULES | PASS | Wave A entitlements surface retained |
| USERS / FACILITIES | PASS | Linked from customer detail tabs |
| MIGRATION CENTER | PASS | Fixture adapter labeled Development fixture |
| RECONCILIATION | PASS | Dedicated `/migrations/reconciliation` with drilldown |
| LAUNCH CUSTOMER | PASS | Stops at READY FOR LAUNCH; no cutover mutation |
| SUPPORT | PASS | `/support` search + session start (Platform Admin client gate) |
| SUPPORT SESSION | CONDITION | Client sessionStorage banner; **server-side audit API not implemented** (GAP-SUP-01) |
| BILLING hub | PASS | Plans/Invoices/Renewals/Revenue show CONDITION where APIs absent |
| HEALTH | PASS | `/health` |
| LOGOUT | PASS | User menu Sign out |

## Role restriction

| Role | Result | Notes |
|------|--------|-------|
| PLATFORM_ADMIN | CONDITION | Full Creator nav when authenticated as platform admin |
| TENANT_ADMIN | CONDITION | Tenant-scoped surfaces; support session denied without platform admin |
| READ_ONLY | CONDITION | Manage actions gated by existing permission checks |

## Module enable/disable

Requires synthetic Development tenant + Products & Modules PUT.  
Status: **CONDITION** until authenticated operator run against synthetic tenant is recorded in this file.

## Fake controls audit (Creator Wave C surfaces)

- Launch cutover: intentionally non-mutating → OK  
- Billing invoices/revenue: labeled not configured → OK  
- Support Map/Retry/Exclude on reconciliation: fixture-local only, labeled → OK  

## Automated coverage

- `apps/configuration-e2e/tests/creator-console-full-smoke.spec.ts`
- `apps/configuration-e2e/tests/wave-c-visual-regression.spec.ts` (overflow matrix; screenshots with `PW_UPDATE_SNAPSHOTS=1`)
- `apps/configuration-e2e/tests/wave-c-accessibility.spec.ts`
