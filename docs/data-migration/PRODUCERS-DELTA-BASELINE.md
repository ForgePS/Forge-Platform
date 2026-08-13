# PRODUCERS — Delta baseline (CONTROLLED-AURORA-IMPORT-S1)

**Status:** NOT RECORDED (import not COMPLETE)

## Intended baseline inputs

When import is marked COMPLETE, record:

- Package generation time: `2026-08-13T18:50:44.627Z` (`manifest.generatedAt`)
- DM-S2 migration run id: `dm-s2-2026-08-13T18-50-37-899Z-a85c875c`
- Import apply run id (authoritative): TBD after clean apply
- Source project: Firebase Industrial (`forge-industrial-safety`)
- Tenant: live `019ff7d0-c20f-7659-81e4-c0cd68e23262`

## Drift

`SOURCE_CHANGES_SINCE_PACKAGE`: **NOT MEASURED** in this sprint.  
Firebase remained writable; a delta sync gate is still required before cutover.

`DELTA_BASELINE_RECORDED`: **FAIL** (blocked on NEEDS_REVIEW import)
