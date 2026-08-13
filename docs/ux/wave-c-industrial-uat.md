# Wave C — Industrial authenticated UAT

Environment: DEVELOPMENT (`https://industrial-dev.forgepublicsafety.com`)  
Evidence date: 2026-08-13  
Credentials: Forge internal DEVELOPMENT UAT identity (not recorded)

## Cases

| Case | Result | Notes |
|------|--------|-------|
| LOGIN | CONDITION | Cognito Hosted UI; run with `E2E_COGNITO_*` |
| TENANT / FACILITY CONTEXT | PASS | Shell bootstrap + facility patterns retained |
| DASHBOARD | PASS | Wave A hierarchy retained |
| MODULE NAVIGATION | PASS | Unavailable modules use friendly messaging |
| PERSONNEL | PASS | Roster + Training/Certifications tabs + Seasonal |
| INCIDENTS | PASS | Multi-step create wizard posts to ops API |
| INSPECTIONS | PASS | Multi-step create wizard (mobile-oriented controls) |
| LOTO | PASS | Energy/isolation flow + record history |
| TRAINING | PASS | List/create + Upcoming/Overdue/Complete chips |
| FLEET | BACKEND_GAP | `/modules/forklifts` documents required fields; no fleet API |
| WORKERS_COMP | CONDITION | UI + role gates; HTTP CRUD missing → dedicated empty state |
| ANALYTICS | DEFERRED_DUE_TO_ACTIVE_WIP | Unrelated WIP preserved; not merged |
| LOGOUT | PASS | Shell sign-out |

## Role restriction

| Role | Result | Notes |
|------|--------|-------|
| Platform Admin support context | CONDITION | Creator support session is separate; Industrial uses normal tenant membership |
| Tenant Admin | PASS | Manage permissions unlock create/status |
| Viewer | PASS | View-only; create hidden |

## Deep workflow notes

- Inspection finalize via dedicated status API remains a backend gap for forms/jsas/observations; inspections create stores checklist fields in payload.
- Personnel Training/Certifications tabs are honest placeholders linking to Training module (assignment API not present).
