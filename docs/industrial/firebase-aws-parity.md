# FORGE-INDUSTRIAL-UX-PARITY-S1 — Firebase ↔ AWS Parity Matrix

**Sprint:** `FORGE-INDUSTRIAL-UX-PARITY-S1`  
**BASE_SHA:** `0034d0797745de5d3af4a4b6e95af3d7be5b9f1d`  
**Branch:** `forge-ui-sneat-s0-s5`  
**Firebase reference:** `C:\Users\jerem\Projects\safety-reports-clone` → https://forge-industrial-safety.web.app  
**AWS app:** `apps/industrial-web` (Sneat theme — non-negotiable)  
**Fleet:** **OUT_OF_SCOPE** — dedicated Fleet sprint pending (do not FAIL/MISSING for Fleet)

## Rules

| Rule | Detail |
|------|--------|
| Firebase | REFERENCE only (workflows, IA, usability) |
| AWS | PRODUCTION platform (Aurora, Cognito, Nest APIs, RLS/RBAC) |
| Theme | Keep Sneat — do not paste Firebase chrome |
| WIP | Preserve unrelated industrial-analytics / Subscription diag WIP |

---

## Cross-cutting

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Shell | Collapsible multi-group sidebar | Registry-driven sidebar groups | PARTIAL | Remap to clearer business groups; hide empty groups |
| Shell | Facility / site selector (TenantSwitcher) | Tenant label only | MISSING | Add location selector from `/industrial/sites` |
| Shell | Universal search | None | MISSING | Add practical search entry (module-scoped first) |
| Shell | Messaging / notifications widget | None in shell | MISSING | Notification bell + deep-links (session-local then API) |
| Shell | Company branding logo | Brand lockup + tenant branding | MATCHED | Keep |
| Uploads | Device/camera → Storage | Mixed; some URL-era patterns may remain | PARTIAL | Common FileUploader; ban URL paste for business files |
| Filters | Consistent filter UX | Shared FilterPanel + chips | IMPROVED | Reused across Ops / Compliance / LOTO |
| Page header | Title + subtitle + actions | `PageHeader` exists | PARTIAL | Standardize all modules |
| Data table | Rich list UX | Bootstrap tables | PARTIAL | Reuse/adapt ForgeDataTable where lists grow |
| Empty/error/loading | Mature | Present but uneven | PARTIAL | Standardize EmptyState / friendly errors |
| Facility context | Workspace site + OrgUnit cascade | Sites list on Settings only | PARTIAL | Global selector + form location fields |
| Analytics nav | Dedicated Analytics module | Nav LEGACY “coming soon”; live panels on Dashboard | REDUNDANT | Promote Analytics route; keep dashboard attention separate |
| Flag keys | — | Dashboard rebuild uses wrong flag keys vs shell | BROKEN | Fix launcher flag derivation |
| Fleet | Not in Firebase | `FleetBackendGap` only | NOT APPLICABLE | OUT_OF_SCOPE this sprint |
| JSAs nav | Duplicate id in Firebase sidebar | Single JSAs entry | IMPROVED | Keep single entry |
| Toolbar export | — | `Toolbar` unused in page-chrome | REDUNDANT | Use or remove |

---

## Dashboard

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Home question | “What needs my attention?” pills | Analytics KPI grid dominates | PARTIAL | Add Attention strip (open incidents, overdue training, etc.) |
| Quick actions | Field/home quick entry | Few header links | MISSING | Permission-aware + Report Incident, Start Inspection, Add Employee, … |
| Recent activity | Period chips + insights | Per-panel recent lists | PARTIAL | Unified Recent Activity section |
| Trends | Safety Index, charts, body map | Analytics overview panels (WIP APIs) | PARTIAL | Keep real APIs; improve presentation |
| Fake data | Live Firestore | Live Nest analytics (when APIs deployed) | MATCHED | Never fabricate |
| Clickable KPIs | Drill to modules | Some drill links | PARTIAL | Ensure every attention card links |

---

## Personnel

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Directory list/search/filter | Full | Ops roster list/search/status | PARTIAL | Richer columns + filters |
| Add / edit / archive | Full profile CRUD | Create + status | PARTIAL | Profile page with tabs |
| Profile tabs | Training, certs, docs, activity | Training/Certs stubs | MISSING | Wire histories when APIs exist; empty CTAs meanwhile |
| Photo upload | Real upload | Not first-class | MISSING | PhotoUploader |
| Seasonal workforce | Feature-flagged | Seasonal workspace when flagged | MATCHED | Keep |
| Company drivers | License/MVR uploads | Not present | MISSING | Phase after core profile |
| Bulk import | CSV/Excel | Import module exists separately | PARTIAL | Personnel import path |
| Inline dept create | Modal pattern | Likely missing | MISSING | Lookup + Add Department modal |

---

## Training

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Dashboard KPIs | Overdue / expiring / completion | Chip filters Upcoming/Overdue | PARTIAL | Dashboard strip |
| Record training (bulk employees) | Multi-select employees | Single-record ops create | MISSING | Bulk Record Training wizard |
| Courses / certificates | Full LMS-ish | Not present | PARTIAL | MVP records first; courses later |
| Attachments | Yes | Limited | PARTIAL | FileUploader |

---

## Incidents

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Categories | Injuries, NM, medical, property, auto | Generic ops list | PARTIAL | Category + severity filters |
| Lifecycle | Workflow, evaluation, RCA, CAPA | Status update only | PARTIAL | Obvious next-action UI |
| Photos / docs | Real uploads | Limited | MISSING | PhotoUploader on report |
| People involved | Yes | Minimal | PARTIAL | Employee selectors |
| Corrective actions | CAPA sync | Not first-class | MISSING | CAPA list on detail |
| Report wizard | Rich form | 3-step create wizard | PARTIAL | Deepen fields without Firebase styling |

---

## Inspections

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Conduct + templates | Classic + EHS Audit Engine | Ops list/create | PARTIAL | Preserve AWS audit depth; simplify entry |
| Findings / CAPA / photos | Full | Limited | PARTIAL | Findings + photo on detail |
| Observations nested | Tabs under inspections | Separate Observations module | INTENTIONALLY CONSOLIDATED | Keep Observations module; cross-link |
| Schedule / finalize / PDF | Yes | Partial | PARTIAL | Finalize + print path |

---

## LOTO

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Unified workspace tabs | Dashboard, Procedures, Auth, QR, … | Dashboard / Procedures / Equipment / Reviews | IMPROVED | Auth/QR tabs deferred |
| Procedures + energy steps | Full | Isolation steps + next-action status | PARTIAL | Procedure detail depth |
| Photos / QR | Yes | Photo on create (data URL) | PARTIAL | Shared S3 uploader + QR later |
| Fragmentation | Avoided in FB | Single AWS workspace | IMPROVED | Keep unified |

---

## Workers Compensation

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Case management | Full tabs (RTW, medical, costs, …) | Overview / Claim / Notes; 404/501 → gap | PARTIAL | Deepen RTW/medical when API ready |
| Sensitive permissions | Gated | Must preserve | MATCHED | Do not weaken |
| Dashboard KPIs | Click → filters | Case KPI cards + FilterPanel | IMPROVED | Keep |

---

## Analytics

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Module tabs | Overview, Custom, Safety, Ops, DOT, Hotspots | Dashboard-embedded panels + WIP hooks | PARTIAL | Dedicated `/modules/analytics` + keep home Attention separate |
| Filters that work | Date/facility/module | Session filter hook | PARTIAL | Wire all controls to APIs |
| Export | PDF/CSV | Client CSV; PDF deferred | PARTIAL | CSV PASS; PDF CONDITION |
| Fake data | No | No | MATCHED | Keep |

---

## Administration

| Reference | Firebase Feature | AWS Feature | Status | Action |
|-----------|------------------|-------------|--------|--------|
| Company / locations / users | Rich SystemAdmin | Admin sections; branding RO + locations | IMPROVED | Deep user admin stays in Creator |
| Hide UUIDs / Cognito / S3 | Mostly | Business language; Advanced hides plumbing | IMPROVED | Keep |
| Notifications settings | Yes | Notifications section placeholder | PARTIAL | Wire when API ready |

---

## Other modules (brief)

| Module | Status | Action |
|--------|--------|--------|
| Observations / JSAs / Forms | PARTIAL (ops MVP) | Align headers/filters; deepen forms |
| DOT / OSHA / Environmental / Contractor / Process / Chemical / Warehouse / Manufacturing | PARTIAL (compliance MVP) | Same standards |
| Confined Space / Hot Work / Heights / Electrical / Machine / Cranes | PARTIAL (high-risk MVP) | Same |
| Equipment | PARTIAL | Keep; Fleet links OUT_OF_SCOPE |
| Forklifts / Fleet | OUT_OF_SCOPE | Gap UI only; reserve nav for future |
| Documents / QR / Messaging / Tasks / Reporting / Import | PARTIAL | Shell standards; no dead placeholders |
| Scan | MISSING | LEGACY — ship or hide until ready |
| Certifications (standalone) | MISSING | Under Personnel until dedicated API |
| Corrective Actions (global) | MISSING | Surface via Incidents/Inspections first |

---

## Implementation waves

| Wave | Scope |
|------|--------|
| **W1** | Parity matrix · Shell facility selector · Nav cleanup · Dashboard Attention + Quick Actions · Analytics route fix · Flag bug |
| **W2** | Personnel profile · Training bulk record · Incident/Inspection photo + next-action |
| **W3** | LOTO tabs · WC polish · Admin sections · Shared FilterPanel/FileUploader |
| **W4** | Mobile field flows · E2E journeys · Visual QA · Build/deploy gates |

---

## Wave 4 progress

| Item | Status |
|------|--------|
| Mobile FilterPanel drawer + active chips | DONE |
| FieldQuickBar (Incident / Inspect / Observe / LOTO) | DONE |
| Responsive shell location + overflow / touch targets | DONE |
| `#ops-create` deep-link scroll for field CTAs | DONE |
| Journey contract tests (`journeys.test.ts`) | DONE |
| Browser Playwright live Cognito E2E | CONDITION (no industrial-web-e2e package / credentials) |
| Visual QA checklist (desktop / tablet / mobile) | DONE (documented; manual spot-check) |
| Lint / typecheck / unit / production build gates | PASS (local industrial-web) |
| Dev/Prod deploy | NOT AUTHORIZED this wave unless asked |
| Fleet E2E | OUT_OF_SCOPE |

### Visual QA checklist

| Check | Desktop | Tablet | Mobile |
|-------|---------|--------|--------|
| Sidebar / drawer | menu | collapse | hamburger drawer |
| No horizontal page overflow | ✓ target | ✓ target | ✓ CSS `overflow-x: clip` |
| Filter UX | panel open | panel | drawer toggle |
| Field CTAs reachable | Quick actions | Quick actions | sticky FieldQuickBar |
| Tables | full | scroll | `.table-responsive` |
| Photo capture | file | file | `capture=environment` |
| Touch targets ≥ 40px | n/a | ✓ | ✓ |
| Footer free of Firebase SoT copy | ✓ | ✓ | ✓ |

### Wave 4 gate results (local)

| Gate | Result |
|------|--------|
| LINT | PASS |
| TYPECHECK | PASS |
| UNIT_TESTS | PASS (43; includes 20 journey contracts) |
| E2E_PERSONNEL…E2E_MOBILE (browser) | CONDITION — journey contracts only; no industrial Playwright package |
| E2E_FLEET | OUT_OF_SCOPE |
| PRODUCTION_BUILD | PASS (`next build` + static export) |
| DEPLOYMENT / LIVE_SMOKE | NOT RUN |

**Sprint verdict:** READY WITH CONDITIONS — Waves 1–4 implemented; do **not** mark FORGE-INDUSTRIAL-UX-PARITY-S1 COMPLETE until live Cognito E2E + deeper Firebase parity gaps are closed. Uncommitted WIP remains on `forge-ui-sneat-s0-s5` (BASE_SHA still `0034d079…` until commit).

---

## Wave 3 progress

| Item | Status |
|------|--------|
| LOTO tabbed workspace (Dashboard / Procedures / Equipment / Reviews) | DONE |
| LOTO next-action status + FilterPanel + photo on create | DONE |
| Workers' Comp case UX (employee-first list, Overview/Claim/Notes) | DONE |
| WC sensitive permission / backend-gap honesty preserved | DONE |
| Admin Settings sections (Company / People / Access / Modules / Notifications / Data / Advanced) | DONE |
| Shared FilterPanel with active chips | DONE |
| FilterPanel wired into Ops + Compliance + LOTO | DONE |
| Dedicated Industrial FileUploader / S3 assets | CONDITION (LocalPhotoField data-URL interim) |
| Editable WC case notes via fields API | PARTIAL (read-only notes tab) |

---

## Redundancy audit (initial)

| Issue | Disposition |
|-------|-------------|
| Analytics “coming soon” vs live dashboard analytics | Consolidate → Analytics module LIVE/MIGRATION |
| Fleet + Forklifts both → gap | Keep Forklifts gap; Fleet OUT_OF_SCOPE alias |
| `/modules/loto` + `/modules/lockout-tagout` | Redirect alias; one label “Lockout/Tagout” |
| Personnel Training tab stub + Training module | Tab → deep-link Training; remove stub duplication |
| Unused `Toolbar` | Wire or delete |
| Dashboard vs shell flag maps | Single `featureFlagForModule` |

---

## Wave 2 progress

| Item | Status |
|------|--------|
| Personnel profile (Overview / Training / Certifications / Activity) | DONE |
| Employee photo upload (no URL paste) | DONE |
| Roster fields: supervisor, employment type, hire date, phone, location | DONE |
| Bulk Record Training (multi-employee) | DONE |
| Incident photo on create + next-action status flow | DONE |
| Inspection photo + next-action + CAPA note | DONE |
| Shared StatusBadge + LocalPhotoField | DONE |
| Ops `/:id/fields` merge API (personnel/training/incidents/inspections) | DONE |
| Inspections status endpoint (was missing) | DONE |
| Dedicated Industrial asset/S3 uploader | CONDITION (data-URL interim) |
| Full Firebase CAPA/RCA/evaluation depth | PARTIAL — next actions + CAPA notes only |

---

| Item | Status |
|------|--------|
| Parity matrix created | DONE |
| Nav groups remapped to Overview / People / Safety / Safety Programs / Compliance / Operations / Communication / Reporting / Administration | DONE |
| CORE renamed Dashboard; Analytics promoted off LEGACY | DONE |
| Facility (location) selector in shell header | DONE |
| Dashboard Attention + Quick Actions | DONE |
| Dashboard flag-key bug fix | DONE |
| Dedicated `/modules/analytics` route | DONE |
| Company label (not Tenant UUID) in header | DONE |
| Notifications bell placeholder | CONDITION (disabled until API) |
| Fleet | OUT_OF_SCOPE |
| Personnel/Training/Incidents deep parity | PENDING (Wave 2+) |

---

## Status legend

MATCHED · IMPROVED · PARTIAL · MISSING · REDUNDANT · BROKEN · INTENTIONALLY CONSOLIDATED · NOT APPLICABLE · OUT_OF_SCOPE
