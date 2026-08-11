# MK-S23 Production Readiness — FORGE-SAAS-CORE

**Program:** FORGE-SAAS-CORE  
**Sprint:** MK-S23  
**Date:** 2026-08-11  
**Production operations performed:** NONE  
**Deployment performed:** NONE  

## Overall verdict

```text
NOT READY
```

SaaS platform IaC and runtime patterns are production-*shaped*, but commercial production cutover is blocked by critical gaps (live SES, real production account/domains, ECS `APP_ENV` hardcode, no production deploy CI/guard). Do **not** authorize production traffic until CRITICAL blockers below are closed and this document is re-verdicted.

| Signal | Meaning |
| --- | --- |
| READY | Safe to authorize production ops for this area |
| CONDITION | Implementable / present; gated or incomplete |
| GAP | Missing, stub, or local-only |
| N/A | Not applicable to this sprint’s SaaS core scope |

---

## Review matrix

### 1. Environment variables — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Runtime Zod load | READY | `packages/environment/src/index.ts` — prod-like requires DB/KMS ARNs + HTTPS public URLs |
| CDK env schemas | READY | `infrastructure/cdk/lib/config/environment-schema.ts` |
| Production CDK baseline | GAP | `infrastructure/cdk/lib/config/production.ts` — account `FORGE_PRODUCTION_ACCOUNT \|\| "000000000000"`, Cognito `academy.example.com` |
| ECS task `APP_ENV` | GAP | `infrastructure/cdk/lib/constructs/forge-ecs.ts` hardcodes `APP_ENV: "development"` (API + worker) |

**Blocker:** Production config and ECS env must be environment-driven before go-live.

---

### 2. Secrets Manager — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Aurora master + app secrets | READY | `forge-database.ts`; GAP-009 import/protection tests |
| Runtime DB secret merge | READY | `packages/environment/src/database-secret.ts` |
| Migrate vs app secret guard | READY | `scripts/run-ecs-migrate.mjs` refuses app secret |
| App CDK `{{resolve:secretsmanager}}` | N/A | Runtime SDK resolution is the chosen path |

**Condition:** Task roles still grant DB master secret read to API task (tighten before prod least-privilege sign-off).

---

### 3. IAM — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Separate execution/task/migrate roles | READY | `forge-ecs.ts` |
| GitHub OIDC deploy (dev) | CONDITION | `docs/deployment/github-oidc-deploy.md`; `.github/workflows/deploy-development.yml` only |
| cdk-nag | CONDITION | `bin/run-nag.ts` with documented suppressions |
| Production deploy role + approval | GAP | No production workflow / approval gate |

---

### 4. Cognito — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| User pool + clients (CDK) | READY | `forge-cognito.ts` / `identity-stack.ts` |
| Dev principal disabled outside local/dev/testing | READY | `docs/security/tenant-isolation.md` |
| Production callback/logout URLs | GAP | Still `example.com` in `production.ts` |
| Auth failure runbook | READY | `docs/operations/authentication-failure-runbook.md` |

---

### 5. Database — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Aurora Serverless v2 + encryption | READY | `forge-database.ts` |
| FORCE RLS / shared DB isolation | READY | ADR-012; `docs/security/tenant-isolation.md` |
| Production capacity knobs | CONDITION | `cost-profile.ts` production profile (unused until real account) |

---

### 6. Migrations — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| ECS one-off migrate runbook | READY | `docs/operations/database-migration-runbook.md` |
| Admin-secret-only migrate | READY | `scripts/run-ecs-migrate.mjs` |
| Down migrations | CONDITION | Forward-only; snapshot restore is rollback |
| Production migrate authorization | GAP | Not separately authorized; must stay tied to change control |

---

### 7. Backups / restore — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| AWS Backup vault/plan construct | READY | `forge-backups.ts` / `backup-stack.ts` |
| Aurora backup retention | READY | Database construct retention knobs |
| Measured restore drill / RPO-RTO | GAP | SOC2 restore-testing procedure exists; controlled drill evidence pending |
| Imports bucket in Backup selection | CONDITION | Versioning-first; not in Backup plan (`docs/operations/import-backup-restore.md`) |

---

### 8. CloudFront / S3 — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Private S3 + OAC + SPA hosting | READY | `forge-static-hosting.ts` + console/rms/tenant-admin wrappers |
| Sync + invalidation | READY | `scripts/sync-static-site.mjs` |
| API CloudFront | CONDITION | Origin to ALB is HTTP until ALB ACM cutover (`forge-api-cloudfront.ts`) |
| Custom DNS front-door | CONDITION | Many apps still `*.cloudfront.net` |

---

### 9. WAF — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Regional WAFv2 on ALB | READY | `forge-ecs.ts` when `enableWaf` (on in production profile) |
| CloudFront (edge) WAF | GAP | Not documented as associated |
| Production WAF policy beyond AWS Managed Common | CONDITION | Single managed rule group baseline |

---

### 10. DNS / ACM / Route53 — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Optional ALB HTTPS construct | READY | `forge-edge-tls.ts` |
| Development / production edge HTTPS enabled | GAP | Development `edge.enableHttps: false`; production config has no real hostnames |
| DNS cutover evidence | CONDITION | Program DNS scripts exist primarily for industrial migration tracks |

---

### 11. SES / email — GAP

| Item | Status | Evidence |
| --- | --- | --- |
| Live SES send | GAP | `SesEmailProvider` stub; no AWS call without injected `sendFn` |
| Default provider | GAP | `NoopEmailProvider` accepted = true without delivery |
| SES CDK identity / IAM | GAP | No SES construct under `infrastructure/cdk` |
| Billing provider live | GAP | `billingProvider` default `NONE` / stub paths |

**Critical:** Invitation and system email cannot be production-trusted until SES (or approved alternative) is wired with verified identity + IAM + non-noop provider.

---

### 12. Logging / alarms / health — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Encrypted log groups | READY | `forge-logging.ts` |
| Dashboards + alarms | READY | `forge-monitoring.ts` |
| ALB/container `/health` | READY | `forge-ecs.ts`; `scripts/smoke-development.mjs` |
| ECS circuit breaker rollback | READY | `circuitBreaker: { rollback: true }` |
| SNS subscribers | CONDITION | Placeholder subscribers — no ops paging wiring |
| CloudTrail | CONDITION | Audit stack when enabled |

---

### 13. Rollback / deploy ordering / post-deploy — CONDITION

| Item | Status | Evidence |
| --- | --- | --- |
| Stack create order | READY | `bin/forge-platform.ts` (Network → … → Compute → Frontend/Backup/Audit) |
| Dev deploy guide | READY | `docs/deployment/development-deployment-guide.md` |
| Destroy guard (prod/staging) | READY | `destroy-guard.ts` requires `FORGE_CONFIRM_DESTROY=YES` |
| Production deploy guard | GAP | `cdk deploy` allowed if credentials resolve; no prod workflow |
| Unified production post-deploy checklist | CONDITION | Piecewise (migrate runbook, smoke script, product rollbacks); no single SaaS go-live gate |
| Production CI/CD | GAP | Only `deploy-development.yml` |

---

## CRITICAL blockers (must clear before any production authorization)

1. **SES / outbound email** — replace noop/stub with verified SES identity, IAM, and live provider.
2. **Production CDK config** — real account, Cognito callback/logout URLs, domains; remove `example.com` / `000000000000` defaults for intended cutover.
3. **ECS `APP_ENV`** — must reflect `FORGE_ENV` / production, not hardcoded `development`.
4. **Production deploy path** — OIDC/workflow + explicit deploy confirmation / approval (not only destroy guard).

## HIGH conditions (required for READY WITH CONDITIONS)

5. ALB HTTPS / ACM / Route53 enabled for API origin (or documented accepted risk for CloudFront→HTTP ALB).
6. Backup **restore drill** with measured RPO/RTO evidence.
7. SNS alarm subscribers + on-call routing.
8. CloudFront WAF (or documented ALB-only WAF acceptance).
9. Single SaaS post-deploy / rollback checklist owned under `docs/forge-saas-foundation/` or `docs/deployment/`.

## MEDIUM follow-ups

10. Least-privilege: API task master-secret read; S3 broad RW review.
11. GuardDuty / Macie / Security Hub flags in cost profile currently unwired.
12. Secondary region declared without multi-region stacks.
13. Close MK-S21 residual security MEDIUM items before go-live (facility ACL depth, webhook signatures, API-key request auth).

---

## Explicit non-goals honored this sprint

- No production deploy / migrate / traffic  
- No industrial-only go-live certificate (RMS/import pilot docs remain separate)  
- No MK-S24 closeout doc packaging  

## Related documents

| Doc | Role |
| --- | --- |
| `docs/deployment/development-deployment-guide.md` | Dev deploy |
| `docs/operations/database-migration-runbook.md` | Migrations |
| `docs/operations/authentication-failure-runbook.md` | Auth ops |
| `docs/security/tenant-isolation.md` | RLS / principals |
| `docs/infrastructure/gap-009-final-reconciliation-report.md` | App secret ownership |
| `docs/forge-saas-foundation/MK-S21-security-review.md` | Security residuals |
| `docs/forge-saas-foundation/MK-S22-UAT.md` | Lifecycle UAT (DB-gated e2e) |

## Re-review trigger

Re-open this document when CRITICAL 1–4 are remediated; target next verdict **READY WITH CONDITIONS** only after HIGH items have owners and dates. Full **READY** requires signed restore drill + production deploy dry-run (still requiring separate production authorization).
