# Producers P2 — Phase 4 Prep Checklist (Final data load + parity)

**Date:** 2026-08-06  
**Status:** PREP ONLY — no Firebase write-freeze and no Producers tenant domain reload until Phase 4 load approval is signed  
**Phase 3 exit:** [`62-producers-p2-phase3-exit.md`](62-producers-p2-phase3-exit.md) **GREEN** (N4 deferred here)  
**Phase 2 exit:** [`60-producers-p2-phase2-exit.md`](60-producers-p2-phase2-exit.md) **GREEN**  
**Phase 1 exit:** [`58-producers-p2-phase1-exit.md`](58-producers-p2-phase1-exit.md) **GREEN**  
**Plan:** [`56-producers-p2-execution-plan.md`](56-producers-p2-execution-plan.md)  
**Pilot auth:** `evidence/p2/00-authorization/APPROVE-PRODUCERS-AWS-PRIMARY-PILOT.md` (Phase 4 production Aurora load **AUTHORIZED** under freeze + parity gates)

## Locked targets

| Item | Value |
| --- | --- |
| Firebase project / business | `forge-industrial-safety` · `business-1782553339499` |
| Staging tenant | `producers-rice-mill-staging` · `0882c865-59c2-49a6-ab88-ce6ca89be30c` |
| Prod twin (dark) | `producers-rice-mill` · `5da680d3-50f5-46ac-8b85-6cf454b6a0da` |
| **Not** SoT landing | `import-acceptance-tenant-a` (`019faa15-e558-70b6-adcd-a510c3c995f4`) — P1 sample only |
| Day-1 modules | Personnel, Equipment, LOTO, Sites/Areas, Documents, Training, Forms, Inspections, Incidents, QR, Confined Space, Hot Work, Tasks, Messaging, Emergency, Reporting (+ Import if catalog ready) |
| Hostname | `https://producers-rice-mill.forgepublicsafety.com/` — still **pre-announce** until Phase 5 |
| Storage | Staging + prod-twin S3 remount **DONE** (Phase 3); stage/prod document metadata: staging docs DONE; prod-twin docs optional |

## Baseline entering Phase 4

| Layer | Staging | Prod twin | Tenant A (sample) |
| --- | --- | --- | --- |
| Tenants / flags / entitlements | Present | Present | Present |
| Cognito roster memberships | 6/6 | 6/6 | N/A for pilot |
| S3 blobs (9077) | Present | Present | N/A |
| `platform_documents` AVAILABLE | 9077 | 0 (optional) | 8 (smoke + PENDING leftovers) |
| Domain rows (sites/equip/LOTO/…) | **Sparse / not full load** | **Sparse / not full load** | ~8.8k NONPRODUCTION_LOAD (waves 1–3) |

**Implication:** Phase 4 is the first **authorized full domain load** onto dedicated Producers tenants. Do not treat Tenant A counts as staging/prod parity.

---

## Phase 4 work packages

### P. Authorization / freeze window

| # | Task | Status |
| --- | --- | --- |
| P1 | Phases 1–3 exits remain green | **DONE** |
| P2 | Sign Phase 4 load approval (staging first; prod twin after staging UAT) | PENDING — draft `evidence/p2/04-parity/APPROVE-PRODUCERS-PHASE4-LOAD.md` |
| P3 | Agree Firebase Producers write-freeze window (owner, start, max duration) | PENDING |
| P4 | Plant ops confirms maintenance notice text + contacts | PENDING |
| P5 | Confirm QR token policy: rotated tokens stay; remint/label plan before Phase 5 | PENDING |

### Q. Extract + map (read-only until approved)

| # | Task | Status |
| --- | --- | --- |
| Q1 | Inventory loader set (wave1/2/3 / migration-firebase) vs day-1 modules | PENDING |
| Q2 | Refresh Producers extract freeze (org-scoped) into imports bucket | PENDING |
| Q3 | Tenant mapping file: Firebase org → staging UUID (and prod twin after green) | PENDING — do **not** reuse wave1 Tenant A mapping as SoT |
| Q4 | Exception catalog: unmapped collections (carry from `54`) | PENDING |
| Q5 | Dry-run counts by domain vs Firebase census | PENDING |

### R. Staging load (after P2 signed)

| # | Task | Status |
| --- | --- | --- |
| R1 | Idempotent load onto `producers-rice-mill-staging` (fail-closed flags) | PENDING |
| R2 | Row count parity report vs Q5 freeze (100% or signed exceptions) | PENDING |
| R3 | RLS verify: forge_app cannot read cross-tenant; staging isolated from twin/A | PENDING |
| R4 | N4 Firebase → S3 URL rewrite on staging domain fields / attachment links | PENDING (deferred from Phase 3) |
| R5 | Optional: upsert prod-twin `platform_documents` if twin UAT needs docs list | PENDING |
| R6 | API + browser smoke day-1 modules on staging host | PENDING |

### S. Staging UAT

| # | Task | Status |
| --- | --- | --- |
| S1 | UAT checklist for day-1 allowlist (admin + operator personas) | PENDING |
| S2 | Producers lead sign-off on staging UAT | PENDING |
| S3 | Defect triage: P0/P1 block twin load; P2+ tracked | PENDING |

### T. Prod-twin dark load (after S2)

| # | Task | Status |
| --- | --- | --- |
| T1 | Soft freeze / delta extract if window elapsed | PENDING |
| T2 | Idempotent load onto `producers-rice-mill` | PENDING |
| T3 | Row parity + RLS vs staging freeze (same freeze SHA preferred) | PENDING |
| T4 | Dark hostname UAT (no Phase 5 announce) | PENDING |
| T5 | QR remint / public-resolver dry-run (blue/green + Firebase fallback still on) | PENDING |

### U. Evidence / exit

| # | Task | Status |
| --- | --- | --- |
| U1 | Folder `evidence/p2/04-parity/` | **DONE** (scaffold) |
| U2 | Freeze + load + parity + RLS + UAT JSON/MD packs | PENDING |
| U3 | Phase 4 exit note | PENDING |

---

## Day-1 module parity matrix (minimum)

| Domain | Staging count gate | Notes |
| --- | --- | --- |
| Sites / areas | Match freeze ± exceptions | Wave1 baseline on Tenant A was 27 sites — re-census |
| Equipment | Match freeze | ~2490 on Tenant A sample — not authoritative for Phase 4 |
| LOTO procedures | Match freeze | ~2524 on Tenant A sample |
| Personnel | Match freeze | ~1009 on Tenant A sample |
| Training / forms / inspections / incidents | Match freeze | Thin on Tenant A — expect growth |
| QR links | Match freeze; tokens **rotated** | Remint policy before Phase 5 |
| Documents | Prefer Phase 3 S3 keys + rewritten links (N4) | Avoid reintroducing Firebase download URLs |
| High-risk / compliance workbooks | Match freeze if day-1 | Else exception log |

Exact freeze numbers come from Q2/Q5 — do not bake Tenant A sample counts into exit criteria.

---

## Gates (fail-closed)

| Gate | Required |
| --- | --- |
| Live extract / load | `APPROVE-PRODUCERS-PHASE4-LOAD.md` **SIGNED** + operator “begin Phase 4 staging load” |
| Firebase write-freeze | Written window + plant ack before final delta |
| Prod-twin load | Staging UAT signed (S2) |
| Phase 5 entry | Phase 4 exit green + rollback drill |

Default without env/approval = **refuse**.

---

## Explicit non-goals for Phase 4

- Phase 5 DNS announce / Cognito-as-only login / SoT flip  
- Disabling Firebase Storage or Auth  
- IND-13 fleet cutover  
- Promoting Tenant A  
- Closing N4 without a staging domain row set  

---

## Ready-to-execute criteria

Phase 4 **prep** is ready when this checklist exists and evidence folder is scaffolded (**now**).

Phase 4 **staging load** may start when:

1. P2 Phase 4 load approval signed  
2. Q2/Q3 freeze + mapping reviewed  
3. Operator confirms **“begin Phase 4 staging load”**  
4. Firebase write-freeze plan acknowledged (can be short / overlapping for dress rehearsal)

---

## Immediate next actions

1. Draft and sign `evidence/p2/04-parity/APPROVE-PRODUCERS-PHASE4-LOAD.md`.  
2. Re-establish loader tooling / `migration-firebase` path on this branch tip (or ECS image that still has it).  
3. Run Q2 dry census → freeze before any write.  

## References

- Phase 3 exit: `62-producers-p2-phase3-exit.md`  
- Dev sample load: `54-producers-dev-load-complete.md` + `evidence/wave1|wave2|wave3/`  
- Storage: `evidence/p2/03-storage/`  
- Cognito: `evidence/p2/02-cognito/`  
