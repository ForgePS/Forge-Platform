# Entitlement integration

## Principle

- **Subscription** = commercial source of truth
- **Entitlements** (`tenant_products`, `tenant_module_entitlements`) = application authorization source of truth
- Client-side subscription status alone never authorizes access

## Sync

`EntitlementSyncService` applies subscription items:

1. Enable products/modules with `source_type=SUBSCRIPTION`, `source_id=<subscriptionId>`
2. On cancel/effective removal, disable those sourced entitlements
3. On suspend, apply `accessPolicy` (ACTIVE+policy flag or GRACE)

Sync states: `SUBSCRIPTION_CHANGE_PENDING` → `ENTITLEMENT_SYNC_PENDING` → `COMPLETE` | `FAILED`

Failures surface in Creator; do not leave silent partial access changes.

## Reconciliation

`GET/POST .../commercial/reconcile` compares commercial items vs entitled modules. Reconcile actions require audit; no silent auto-correction.

## Products & Modules UI

Billable module changes should route through commercial subscription change. Non-billable administrative overrides require reason + audit and create Attention mismatches when commercial ≠ entitled.
