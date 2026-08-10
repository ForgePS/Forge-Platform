# FORGE-SAAS-CORE Backlog

Items discovered during sprints but not authorized for implementation.

---

## BACKLOG-001

Discovered During:
MK-S0

Description:
Industrial Cognito client / CloudFormation export (`ForgeIdentity-IndustrialClientId`) is expected by compute/deploy scripts but appears incomplete on `ForgeCognito` construct relative to academy/rms/creator/department/student clients.

Reason Deferred:
Identity client wiring is outside MK-S0 documentation scope; belongs with auth hardening or industrial product work.

Suggested Sprint:
MK-S2

Priority:
MEDIUM

Blocking Current Sprint:
NO

---

## BACKLOG-002

Discovered During:
MK-S0

Description:
Industrial web UI calls `/api/v1/industrial/analytics/*` and related industrial site APIs that are not present on `platform-api` in this baseline.

Reason Deferred:
Product analytics / industrial API parity is not SaaS-core foundation work for MK-S0 and is already in-progress separately in the working tree.

Suggested Sprint:
(product track — industrial analytics); optional SaaS analytics later in MK-S20

Priority:
HIGH

Blocking Current Sprint:
NO

---

## BACKLOG-003

Discovered During:
MK-S0

Description:
No Stripe (or other PSP) adapter; subscriptions use `billingProvider` default `NONE`. Provider-neutral billing domain exists partially.

Reason Deferred:
Billing provider integration is MK-S9/MK-S10.

Suggested Sprint:
MK-S9

Priority:
HIGH

Blocking Current Sprint:
NO

---

## BACKLOG-004

Discovered During:
MK-S0

Description:
No SES / notification delivery engine. SQS notification queue and Config Studio email/notification templates exist; Cognito handles invite email in non-branded cases.

Reason Deferred:
Notification/email sprint is MK-S13.

Suggested Sprint:
MK-S13

Priority:
HIGH

Blocking Current Sprint:
NO

---

## BACKLOG-005

Discovered During:
MK-S0

Description:
No first-class tenant/platform API key product (hash, prefix, scopes, revoke). Import adapters have source `api_key` auth type which is unrelated.

Reason Deferred:
API keys / webhooks productization is MK-S15.

Suggested Sprint:
MK-S15

Priority:
MEDIUM

Blocking Current Sprint:
NO

---

## BACKLOG-006

Discovered During:
MK-S0

Description:
Generic outbound customer webhooks are not productized. CAD inbound webhook security patterns exist and should be reused as a model.

Reason Deferred:
MK-S15 scope.

Suggested Sprint:
MK-S15

Priority:
MEDIUM

Blocking Current Sprint:
NO

---

## BACKLOG-007

Discovered During:
MK-S0

Description:
Department portal, student portal, and public registration apps are placeholders (`NOT_STARTED`) despite Cognito app clients existing.

Reason Deferred:
Portal product delivery is outside early SaaS core sprints; foundation already supports shared Cognito + memberships.

Suggested Sprint:
After MK-S8 / product backlog

Priority:
LOW

Blocking Current Sprint:
NO

---

## BACKLOG-008

Discovered During:
MK-S0

Description:
Creator Console still uses a local API client (`apps/creator-console/src/lib/api.ts`) instead of consolidating fully on `@forge/web-kit`.

Reason Deferred:
Client consolidation is a refactor risk; not required for baseline.

Suggested Sprint:
MK-S8 or MK-S17

Priority:
LOW

Blocking Current Sprint:
NO

---

## BACKLOG-009

Discovered During:
MK-S0

Description:
Dual UI tracks: Industrial uses vendored Sneat Free; RMS uses `@forge/fx-*`; Creator/Tenant Admin use `@forge/ui` + design-system. SaaS shell sprint must not force a redesign of operational modules.

Reason Deferred:
Shell unification is MK-S8 with explicit preserve-existing guidance.

Suggested Sprint:
MK-S8

Priority:
MEDIUM

Blocking Current Sprint:
NO

---

## BACKLOG-010

Discovered During:
MK-S0

Description:
“Facilities” appear as Configuration Studio namespaces / documents in tenant-admin/creator, while RMS sites map to `rms_stations`. No single canonical SQL `facilities` table for all products.

Reason Deferred:
Canonical tenant domain modeling for facilities/sites is MK-S1 scope.

Suggested Sprint:
MK-S1

Priority:
HIGH

Blocking Current Sprint:
NO
