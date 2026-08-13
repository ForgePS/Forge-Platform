# Pricing model

## Money

All amounts use **integer minor units (cents)**. Never use floating-point for money.

Helpers: `formatUsd`, `addCents`, `subtractCents`, `percentOfCents`, `computeArrCents`, `computeMrrCents`, `prorateCents` in `@forge/contracts` commercial module.

## Catalog vs effective price

| Field | Meaning |
|-------|---------|
| Catalog / plan version `basePriceCents` | List price (immutable history via plan versions) |
| Subscription `catalogPriceCents` | Snapshot of catalog at sale |
| Subscription `effectivePriceCents` | Negotiated customer price |
| Difference + reason | Stored on subscription change / discount link |

Custom pricing never overwrites plan version rows.

## Plan versions

`subscription_plan_versions` preserves historical pricing. New customers select the active version; existing customers remain on contracted version until renew/modify.

## Recurring composition

```
Base subscription
+ Module / add-on charges
− Discounts (stacking controlled by discount.stackable)
= Recurring total
```

Implementation fees and one-time charges are **excluded** from ARR/MRR.

## Billing frequencies

MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, CUSTOM.

ARR = normalize recurring to annual. MRR = normalize to monthly.
