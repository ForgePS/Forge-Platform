# Phase 3 Storage evidence index

**Status:** Staging S3 copy + Aurora metadata + presign smoke COMPLETE — N4/M4/O3 still open  
**Prep:** `../../61-producers-p2-phase3-prep.md`  
**Freeze:** `storage-inventory-2026-08-06T01-06-44-696Z.json` · bucket `forge-industrial-safety.firebasestorage.app`  
**Map:** `s3-map-staging-2026-08-06T11-13-35-876Z.json` → `forge-development-documents-511343547817-us-east-1` · tenant `0882c865-59c2-49a6-ab88-ce6ca89be30c`  
**Copy:** `s3-copy-staging-result-2026-08-06T11-42-50-933Z.json` · reconcile `s3-copy-staging-reconcile.json`  
**Metadata:** `aurora-document-metadata-result.json` (9077 documents / 9077 AVAILABLE versions)  
**Presign:** `presign-smoke.json` (certificate / equipment / LOTO — 3/3 HTTP 200)

| Artifact | Purpose |
| --- | --- |
| `APPROVE-PRODUCERS-STORAGE-INVENTORY.md` | **SIGNED** — read-only census |
| `av-approach-decision.md` | **SIGNED** — Option B waiver to 2026-09-05 |
| `APPROVE-PRODUCERS-STORAGE-COPY.md` | **SIGNED** — staging Storage → S3 |
| `APPROVE-PRODUCERS-STORAGE-AURORA-METADATA.md` | **SIGNED** — staging platform document upsert |
| `storage-inventory-*` | Freeze + summary |
| `s3-map-staging-*` | Dry-run key map |
| `s3-copy-staging-result.json` | Latest copy result (9074 copied + 3 skipped, 0 errors) |
| `s3-copy-staging-reconcile.json` | S3 list count/bytes vs inventory |
| `s3-copy-staging-objects-*.json` | Per-object status sidecar |
| `aurora-document-probe-*` | Read-only table/count probe |
| `aurora-document-metadata-dry-run-*` | N1/N2 dry-run evidence |
| `aurora-document-metadata-result.json` | N1/N2 apply result (9077 AVAILABLE) |
| `presign-smoke.json` | N3 download path smoke (**PASS**) |
