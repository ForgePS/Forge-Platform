# APPROVE PRODUCERS PHASE 4 LOAD (parity)

**Status:** UNSIGNED — pending Program Owner signature  
**Drafted:** 2026-08-06  
**Governing docs:** DEC-IND-011 · `56-producers-p2-execution-plan.md` · `63-producers-p2-phase4-prep.md` · `APPROVE-PRODUCERS-AWS-PRIMARY-PILOT.md`

---

## Authorization requested

| Field | Value |
| --- | --- |
| Scope | Final Producers domain extract → Aurora load for parity/UAT |
| First target | `producers-rice-mill-staging` · `0882c865-59c2-49a6-ab88-ce6ca89be30c` |
| Second target | `producers-rice-mill` · `5da680d3-50f5-46ac-8b85-6cf454b6a0da` (only after staging UAT signed) |
| Source | Firebase `forge-industrial-safety` · `business-1782553339499` |
| Includes | Day-1 module row load, N4 URL rewrite on staging, parity/RLS evidence, dark twin load |
| Firebase write-freeze | Required for final delta; window TBD before T1 |

## Explicitly NOT authorized by this record

| Workstream | Status |
| --- | --- |
| Phase 5 DNS announce / SoT flip | NOT AUTHORIZED |
| Disable Firebase Auth or Storage | NOT AUTHORIZED |
| Load onto `import-acceptance-tenant-a` as SoT | NOT AUTHORIZED |
| Fleet-wide IND-13 | NOT AUTHORIZED |

## Preconditions

- [ ] Phases 1–3 exit green  
- [ ] Phase 4 prep checklist reviewed  
- [ ] Extract freeze path + tenant mapping reviewed  
- [ ] This record signed by Program Owner  
- [ ] Operator confirms **“begin Phase 4 staging load”**  

## Signatures

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Program Owner | | | |
| Producers lead (UAT owner) | | | |

## Evidence destination

`docs/program/industrial-migration/ind-11/evidence/p2/04-parity/`
