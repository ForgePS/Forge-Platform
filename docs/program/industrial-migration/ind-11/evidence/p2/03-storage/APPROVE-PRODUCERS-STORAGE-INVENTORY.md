# APPROVE PRODUCERS STORAGE INVENTORY (Phase 3)

**Status:** UNSIGNED — NOT AUTHORIZED  
**Drafted:** 2026-08-05  
**Governing docs:** DEC-IND-011 · `56-producers-p2-execution-plan.md` · `61-producers-p2-phase3-prep.md` · `32-file-migration-plan.md`

---

## Authorization requested

| Field | Value |
| --- | --- |
| Scope | Read-only Firebase Storage object inventory for Producers Rice Mill |
| Firebase project | `forge-industrial-safety` |
| Firebase business | `business-1782553339499` |
| Purpose | Freeze object counts/sizes/checksums before S3 copy |
| Writes | **NONE** — list/metadata/checksum read only; no S3 copy in this approval |

## Allowed data

- Object path / name, size, contentType, generation, updated, md5Hash / crc32c  
- Classification hints from path prefixes  
- Aggregate counts and byte totals  

## Explicitly NOT authorized by this record

| Workstream | Status |
| --- | --- |
| Storage → S3 copy / overwrite | NOT AUTHORIZED (separate K5) |
| Aurora document metadata mutation | NOT AUTHORIZED |
| Disable Firebase Storage uploads | NOT AUTHORIZED |
| Fleet-wide (non-Producers) Storage inventory | NOT AUTHORIZED |

## Preconditions

- [x] Phase 2 exit green (`60-producers-p2-phase2-exit.md`)  
- [x] Pilot auth authorizes Storage→S3 for Producers (copy still gated)  
- [ ] AV approach chosen (K3) — soft for inventory; **hard** before copy  
- [ ] This record signed by Program Owner  
- [ ] Operator confirms “begin Phase 3 Storage inventory” after signature  

## Signatures

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Program Owner | Jeremy | | |
| Platform / Ops Lead (optional) | | | |

## Evidence destination

`docs/program/industrial-migration/ind-11/evidence/p2/03-storage/`
