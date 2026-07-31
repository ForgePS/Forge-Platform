# 05 — Permission Validation

Backend remains authoritative. UI checks must match existing FeatureGate + role visibility.

Representative personas: platform admin, tenant admin, operational user, reviewer, approver, read-only, soft-auth, unauthorized.

Per-module maps live under `modules/<module>/03-permission-map.md`.

CAD Messages: `FeatureGate` `cadOperations` — see `modules/cad-messages/03-permission-map.md`.  
Administration / Utilities: session auth + `chooseTenant`; no product FeatureGate on `/select-tenant/` or `/health/` — see `modules/administration/03-permission-map.md`. Login deferred (auth out of scope).
