# Wave C — Accessibility

Target: WCAG 2.1 AA practical compliance for Creator priority routes.

## Automated

- `@axe-core/playwright` suite: `apps/configuration-e2e/tests/wave-c-accessibility.spec.ts`
- Tags: `wcag2a`, `wcag2aa`
- Routes: `/`, `/tenants/`, `/migrations/`, `/support/`, `/billing/`, `/health/`
- Fail on critical/serious impacts

Existing coverage also in `apps/configuration-e2e/tests/accessibility.spec.ts`.

## Manual checklist

| Check | Status | Notes |
|-------|--------|-------|
| Keyboard navigation | CONDITION | Tab order through shell + page actions |
| Focus visibility | CONDITION | Forge focus styles |
| Dialog focus | CONDITION | Support session / modals where present |
| Form labels | PASS | Onboarding + ops create fields use htmlFor |
| Error association | CONDITION | Inline errors near fields |
| Checkbox / toggle labels | PASS | Onboarding product/module checkboxes |
| Accessible names | PASS | Tablists use role=tablist on customer detail / personnel |
| Contrast | CONDITION | Sneat/Forge tokens |
| Touch targets | PASS | Industrial wizard uses btn controls |

Run authenticated axe against Development before promoting:  
`pnpm --filter @forge/configuration-e2e test -- tests/wave-c-accessibility.spec.ts`
