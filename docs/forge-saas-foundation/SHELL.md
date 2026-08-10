# Application Shell (MK-S8)

Multi-track shell strategy: **behaviors** are shared; **visual chrome** stays product-owned (BACKLOG-009).

## Tracks

| Track | App | Shell |
| --- | --- | --- |
| Forge UI | Creator Console, Tenant Admin | `ForgeAppShell` (`@forge/ui`) |
| Sneat | Industrial | `IndustrialShell` |
| FX / legacy | RMS | `RmsShellBoundary` / FX layouts |

Do **not** force a Makerkit redesign or a single CSS framework across products.

## Required chrome (directive)

| Area | `@forge/ui` | Creator / Tenant Admin | Industrial (Sneat) |
| --- | --- | --- | --- |
| Responsive sidebar + mobile drawer | `ForgeAppShell` / `ForgeSidebar` | Yes | Yes |
| Top bar | `ForgeTopbar` | Yes | Yes |
| Tenant switcher | `ForgeTenantSwitcher` | Yes | Yes |
| Product switcher | `ForgeProductSwitcher` | Yes (session products) | Product gate on session |
| Facility selector | `ForgeFacilitySelector` | Empty stub until catalog API | Empty stub label |
| Breadcrumb / page title | `ForgeBreadcrumbs` / `ForgePageHeader` | Profile + pages | In-module |
| Notification icon | `ForgeNotificationMenu` (disabled stub) | Yes | Deferred |
| Search trigger | `ForgeSearchTrigger` (disabled → MK-S18) | Yes | Disabled stub |
| Profile menu | `ForgeUserMenu` + `/profile` | Yes | Yes |
| Help / settings | `ForgeHelpMenu` + settings links | Yes | Yes |

## Shell area states

`ForgeShellState` supports:

```text
loading | empty | error | unauthorized | disabled_entitlement | ready
```

Chrome controls also accept matching `state` props where list-driven (tenant/product/facility).

## Navigation entitlements

Prefer `filterNavigationForSession` from `@forge/web-kit` (permissions + products + modules). Creator Console uses it; Tenant Admin passes `modules` into `filterNavigationGroups`.

## Out of scope / deferred

- Notification delivery (BACKLOG-004 / 018)
- Command palette search (MK-S18)
- Creator auth → full web-kit consolidation (BACKLOG-008)
- RMS FX default-on / restyle
- Facility ACL enforcement (BACKLOG-016)
