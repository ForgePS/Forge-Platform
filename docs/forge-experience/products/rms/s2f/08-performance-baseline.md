# 08 — Performance Baseline

Establish baseline before each module migration. Measure initial render, time-to-usable, tables, tabs, autosave chrome, dialogs, flag evaluation overhead.

Do not claim improvement without evidence. Material regressions require documented approval.

S2F-3: CAD messages continues full-list fetch (legacy parity); no new pagination introduced.

S2F-4: CAD connections continues full-list fetch + same create/action POSTs; no new pagination.

S2F-5: CAD conflicts continues OPEN full-list fetch + same resolve POSTs; no new pagination.

S2F-6: NERIS configuration continues dual GET + same PUT saves; no new polling.

S2F-7: select-tenant uses session tenants (no list API); health single GET `/health`.
