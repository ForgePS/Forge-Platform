# Subscription lifecycle

## Commercial statuses

| Status | Label |
|--------|-------|
| DRAFT | Draft |
| TRIAL | Trial |
| PENDING_ACTIVATION | Pending Activation |
| ACTIVE | Active |
| PAST_DUE | Past Due |
| SUSPENDED | Suspended |
| CANCEL_SCHEDULED | Cancellation Scheduled |
| CANCELLED | Cancelled |
| EXPIRED | Expired |

## Valid transitions (examples)

- DRAFT → PENDING_ACTIVATION → ACTIVE
- TRIAL → ACTIVE | EXPIRED | CANCELLED
- ACTIVE → PAST_DUE → ACTIVE
- ACTIVE → SUSPENDED → ACTIVE (reactivate)
- ACTIVE → CANCEL_SCHEDULED → CANCELLED
- ACTIVE → EXPIRED

Arbitrary mutations are rejected server-side. Every transition writes `subscription_changes`, `subscription_events`, audit, and outbox.

## Access policy on suspension

Configurable `accessPolicy` on the subscription:

- FULL_ACCESS
- WRITE_RESTRICTED
- READ_ONLY
- SUSPENDED

Industrial/RMS safety data is not blindly destroyed. Suspension updates entitlement access according to policy rather than deleting historical records.

## Auto-renew

`autoRenew` schedules renewal reminders and term rollover jobs. It does **not** auto-charge cards unless a payment provider is enabled.
