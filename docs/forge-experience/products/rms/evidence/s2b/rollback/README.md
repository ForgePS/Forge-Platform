# FX-S2B Rollback Evidence

Mechanism: disable `fx.rms.shell.enabled` (+ nav) → `RmsLegacyShellAdapter`.

Automated coverage: `resolveRmsFxPresentationFlags` unit tests; Playwright matrix with env overrides.
