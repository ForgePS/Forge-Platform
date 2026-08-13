# PRODUCERS — File reconciliation (CONTROLLED-AURORA-IMPORT-S1)

**Status:** NOT COMPLETE (promotion not executed in this sprint)

## Source corpus (staging)

`s3://forge-production-imports-511343547817-us-east-1/storage/source/`

| Class | Count |
| --- | --- |
| Customer-confirmed | 9292 |
| Platform global | 12 |
| Excluded orphan test (`dqf-exports/test/...`) | 1 |
| Ambiguous | 0 |
| **Total** | **9305** |

## Authoritative destination

Documents bucket (from production API config / prior IND-11 architecture):  
`forge-production-documents-511343547817-us-east-1`

## Promotion results

| Metric | Value |
| --- | --- |
| CUSTOMER_FILES_PROMOTED | **0** (not run) |
| PLATFORM_GLOBAL_FILES into Producers | **0** (must remain 0) |
| ORPHAN_FILE_PROMOTED | **NO** |
| MISSING_CUSTOMER_FILES | N/A until promotion |
| WRONG_TENANT_FILES | N/A until promotion |
| BROKEN_ATTACHMENT_REFERENCES | pending post-promotion validation |

Do not delete staging copies. Use server-side S3 copy with SSE-KMS and tenant-scoped keys.
