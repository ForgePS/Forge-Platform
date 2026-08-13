# PRODUCERS — Aurora import reconciliation (CONTROLLED-AURORA-IMPORT-S1)

**Status:** NEEDS REVIEW  
**Live tenant:** `019ff7d0-c20f-7659-81e4-c0cd68e23262` (`producers-rice-mill`)  
**Package twin tenant (remapped):** `5da680d3-50f5-46ac-8b85-6cf454b6a0da`  
**Import run (latest apply):** `cai-s1-apply2-20260813T213639Z`

## Source accounting (package)

| Bucket | Count |
| --- | --- |
| AURORA_OPERATIONAL | 15914 |
| AURORA_HISTORY | 26139 |
| PLATFORM_GLOBAL | 69 |
| EXCLUDE_APPROVED | 143 |
| S3_ARCHIVE | 0 |
| **TOTAL** | **42265** |

EXCLUDE files processed: 14 files / 143 lines (accounted; not loaded into operational tables).

## Write outcomes (apply #2)

Importer does **not** treat platform-default (`awsTenantId=null`, `awsTenantKey=platform-default`) rows as Producers writes — those are skipped (`missing_tenant`). That explains ~50% skips on many specialty modules that ship forge-default + Producers pairs.

### Residual unexplained / failed writes

| DOMAIN / ENTITY | ISSUE | COUNT | STATUS |
| --- | --- | --- | --- |
| QR link versions | unresolved `qr_link_id` (parent not in Producers id-map) | 3902 errors; 1198 inserted | NEEDS_FIX |
| EHS template versions | logical `templateId` not Firestore source id | 34 | NEEDS_FIX |
| Attachments | mapping/required fields | 13 | NEEDS_FIX |
| Equipment document links | FK/mapping | 12 | NEEDS_FIX |
| Inspections | 1 status null | 1 | NEEDS_FIX |

`UNEXPLAINED_DB_DIFFERENCE`: **not zero** until residual entities are remapped or explicitly classified as out-of-scope skips.

`FATAL_IMPORT_ERRORS` (security / cross-tenant / schema mismatch): **0**  
`FABRICATED_VEHICLES`: **0**

## Tenant ownership

All applied Producers operational rows targeted live tenant `019ff7d0-...` via remap. Platform EHS templates inserted as global (null tenant) where schema allows.
