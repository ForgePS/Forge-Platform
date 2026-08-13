# Wave C — Responsive matrix

Tooling: Playwright viewport suite in `apps/configuration-e2e/tests/wave-c-visual-regression.spec.ts`  
Assertion: `document.documentElement.scrollWidth <= clientWidth + 1` (no global overflow-x:hidden hide)

## Viewports

| Viewport | Creator Dashboard overflow | Notes |
|----------|----------------------------|-------|
| 1920×1080 | RUN_WITH_CREDS | Desktop |
| 1600×900 | RUN_WITH_CREDS | Desktop |
| 1440×900 | RUN_WITH_CREDS | Primary desktop baseline |
| 1366×768 | RUN_WITH_CREDS | Laptop |
| 1280×800 | RUN_WITH_CREDS | Laptop |
| 1024×768 | RUN_WITH_CREDS | Small laptop / tablet landscape |
| 768×1024 | RUN_WITH_CREDS | Tablet |
| 430×932 | RUN_WITH_CREDS | Mobile |
| 390×844 | RUN_WITH_CREDS | Mobile |

## Priority routes checked for overflow (when credentials present)

Creator: Dashboard, Customers, Products & Modules, Migration Center, Reconciliation, Launch, Support, Billing, Health  
Industrial: Dashboard, Personnel, Incidents, Inspections, LOTO, Training, Forklifts (Fleet gap page)

## Manual review checklist

| Route class | HORIZONTAL_OVERFLOW | CLIPPING | OVERLAP | ACTION_REACHABILITY | FORM_USABILITY |
|-------------|---------------------|----------|---------|---------------------|----------------|
| Creator standard | Asserted in Playwright | Visual | Visual | Sticky actions in Forge chrome | Wizard Back/Next |
| Industrial ops | Asserted in Playwright | Visual | Visual | Touch btn-sm+ | Incident/Inspection wizard |

Record PASS for a viewport only after the Playwright overflow test for that size succeeds against Development.
