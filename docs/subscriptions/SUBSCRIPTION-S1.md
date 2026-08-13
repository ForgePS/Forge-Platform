# Forge Subscription-S1

Comprehensive commercial subscription, billing, and entitlement synchronization for Forge Creator Console.

## Scope

- Plans & plan versions (historical pricing preserved)
- Multi-product subscriptions (Industrial, RMS, Academy)
- Module add-ons, implementation fees, discounts, credits
- Invoices, payments, contracts (manual billing first)
- Renewals, trials, suspension, cancellation, reactivation
- ARR/MRR revenue analytics from authoritative ledger data
- Entitlement sync from commercial items (subscription remains commercial SoT; entitlements remain auth SoT)

## Architecture

```
Commercial records (subscriptions, items, invoices, payments)
        │
        ▼
Entitlement sync (tenant_products / tenant_module_entitlements, source_type=SUBSCRIPTION)
        │
        ▼
Authorization (membership ∩ entitlements ∩ operational subscription status)
```

## Key packages

| Area | Location |
|------|----------|
| Contracts / money | `packages/contracts/src/commercial.ts` |
| Schema / migration | `packages/database/src/schema/commercial.ts`, `drizzle/0030_subscription_commercial_s1.sql` |
| API | `apps/platform-api/src/modules/commercial/` |
| Creator UI | `apps/creator-console/src/app/business/` |

## Payment processing

Default: **Manual**. No Stripe/Square charge UI until a provider is configured. Provider abstraction fields (`billing_provider`, `external_*_id`) are nullable placeholders.

## Development

1. Apply migration `0030_subscription_commercial_s1`
2. Deploy platform-api + Creator Console to Development
3. Use Business navigation in Creator

## Production

**NOT AUTHORIZED** by Subscription-S1 mission. Promote only after authenticated UAT and financial reconciliation PASS.
