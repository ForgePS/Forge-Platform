# Commercial RBAC

## Permissions

| Permission | Intent |
|------------|--------|
| platform.subscription.view | Read subscriptions |
| platform.subscription.create | Create |
| platform.subscription.update | Edit drafts / items |
| platform.subscription.activate | Activate / convert trial |
| platform.subscription.suspend | Suspend |
| platform.subscription.cancel | Cancel |
| platform.subscription.renew | Renew |
| platform.plan.view / manage | Plans & versions |
| platform.billing.view | Billing dashboards |
| platform.invoice.* | Invoice lifecycle |
| platform.payment.* | Record/view payments |
| platform.discount.manage | Discounts |
| platform.credit.manage | Credits |
| platform.contract.* | Contracts |
| platform.revenue.view | ARR/MRR reports |

Creator-only elevated billing mutations are included in `CREATOR_ONLY_PERMISSIONS`.

Migration ease: many endpoints also accept `platform.entitlement.manage` for existing Platform Admins.

## Roles

| Role | Access |
|------|--------|
| Platform Admin | Full |
| Billing Admin | Subscriptions, invoices, payments, credits, renewals |
| Account Manager | View + limited renew |
| Support | Read-only commercial summary |
| Tenant Admin | No Creator commercial management |

## Isolation

- Tenant RLS on commercial tenant tables
- Platform list uses approved `bypass_rls` platform transaction
- CROSS_TENANT_READ/WRITE for tenant principals: DENIED
