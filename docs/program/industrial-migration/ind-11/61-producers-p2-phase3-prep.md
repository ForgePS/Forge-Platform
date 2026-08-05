# Producers P2 — Phase 3 Prep Checklist (Storage → S3)

**Date:** 2026-08-05  
**Status:** PREP ONLY — no Firebase Storage live inventory and no S3 copy until inventory approval + AV approach are signed  
**Phase 2 exit:** [`60-producers-p2-phase2-exit.md`](60-producers-p2-phase2-exit.md) **GREEN**  
**Plan:** [`56-producers-p2-execution-plan.md`](56-producers-p2-execution-plan.md)  
**Foundational plan:** [`../32-file-migration-plan.md`](../32-file-migration-plan.md)

## Locked targets

| Item | Value |
| --- | --- |
| Firebase project | `forge-industrial-safety` |
| Firebase business | `business-1782553339499` |
| Staging tenant | `producers-rice-mill-staging` · `0882c865-59c2-49a6-ab88-ce6ca89be30c` |
| Prod twin tenant | `producers-rice-mill` · `5da680d3-50f5-46ac-8b85-6cf454b6a0da` |
| Scope | **All** Producers Firebase Storage objects (pilot auth already AUTHORIZED) |
| S3 key convention | `tenants/{tenantId}/documents/{documentId}/{versionId}/{filename}` |
| Aurora docs today | Many `PENDING_UPLOAD` / path-only placeholders (dev load) |

**Do not** copy onto `import-acceptance-tenant-a` as production SoT.

---

## Phase 3 work packages

### K. Authorization / AV gate

| # | Task | Status |
| --- | --- | --- |
| K1 | Phase 2 exit remains green | **DONE** (`60`) |
| K2 | Pilot auth already authorizes Storage→S3 for Producers | **DONE** (Phase 0 signed) |
| K3 | Choose AV approach: production scanner **or** time-boxed waiver | PENDING |
| K4 | Sign read-only Storage inventory approval | PENDING — `evidence/p2/03-storage/APPROVE-PRODUCERS-STORAGE-INVENTORY.md` |
| K5 | Sign S3 copy approval (staging first) after inventory freeze | PENDING |

### L. Read-only Storage inventory

| # | Task | Status |
| --- | --- | --- |
| L1 | Tooling: list Producers-scoped Storage objects (path prefixes / metadata rules) | PENDING |
| L2 | Capture object path, size, contentType, md5/crc, updated time | PENDING |
| L3 | Classify categories (LOTO, equipment, certificates, general docs, QR images, other) | PENDING |
| L4 | Produce freeze `storage-inventory-<date>.json` + count/size summary | PENDING |
| L5 | Exception list: zero-byte, missing contentType, orphan paths, unscoped objects | PENDING |

### M. S3 copy (staging first)

| # | Task | Status |
| --- | --- | --- |
| M1 | Dry-run key map Storage path → S3 key for prod-twin **or** staging tenant | PENDING |
| M2 | Parallel copy with checksum verify (staging bucket / prefix) | PENDING |
| M3 | Object count + sample checksum reconciliation | PENDING |
| M4 | Repeat to prod-twin prefix after staging green (or single shared prefix policy — decide in M1) | PENDING |

### N. Aurora metadata + download path

| # | Task | Status |
| --- | --- | --- |
| N1 | Map inventory rows → `industrial_documents` / attachment metadata | PENDING |
| N2 | Flip `PENDING_UPLOAD` → ready with S3 key + integrity fields | PENDING |
| N3 | Presigned download smoke: equipment doc, LOTO attachment, certificate | PENDING |
| N4 | URL rewrite pass for known Firebase permanent URLs in records | PENDING |

### O. Evidence

| # | Task | Status |
| --- | --- | --- |
| O1 | Folder `evidence/p2/03-storage/` | **DONE** (scaffold) |
| O2 | Inventory + copy + metadata result JSON | PENDING |
| O3 | Phase 3 exit note | PENDING |

---

## AV decision (required before copy)

| Option | When to use |
| --- | --- |
| A — Production scanner | Preferred if GuardDuty Malware Protection / clam / vendor path is ready |
| B — Time-boxed waiver | Allowed for pilot with written expire date + sample re-scan commitment |

**Decision:** _TBD — record in K3 evidence when chosen._

---

## Script sketch (not executed in this prep)

```text
scripts/ind11b-p2-storage-inventory-plan.mjs     # refuse without FORGE_P2_STORAGE_INVENTORY_AUTHORIZED
scripts/ind11b-p2-run-storage-inventory.mjs      # RO live list + checksum census
scripts/ind11b-p2-storage-s3-map.mjs             # dry-run key map
scripts/ind11b-p2-run-storage-s3-copy-staging.mjs
scripts/ind11b-p2-storage-presign-smoke.mjs
```

Gates (fail-closed):

- `FORGE_P2_STORAGE_INVENTORY_AUTHORIZED=true` only after K4 signed  
- `FORGE_P2_STORAGE_COPY_AUTHORIZED=true` only after K3 + K5  
- Default = dry-run / refuse live  

---

## Explicit non-goals for Phase 3

- No Firebase Auth disable / SoT flip (Phase 5)  
- No full Aurora transactional reload (Phase 4)  
- No IND-13 fleet Storage migration  
- No announcing hostname as production  

---

## Ready-to-execute criteria

Phase 3 **inventory** may start when:

1. Phase 2 exit remains green  
2. `APPROVE-PRODUCERS-STORAGE-INVENTORY.md` signed  
3. Operator confirms **“begin Phase 3 Storage inventory”**  

Phase 3 **copy** additionally requires K3 AV decision + K5 copy approval.

---

## Immediate prep actions (this pass)

1. Draft unsigned Storage inventory approval.  
2. Scaffold `evidence/p2/03-storage/`.  
3. Point plan 56 at this checklist.  

## References

- Files: `../32-file-migration-plan.md`  
- Pilot auth: `evidence/p2/00-authorization/APPROVE-PRODUCERS-AWS-PRIMARY-PILOT.md`  
- Dev load note: `54-producers-dev-load-complete.md` (PENDING_UPLOAD placeholders)  
