# APPROVE PRODUCERS AWS-PRIMARY PILOT

**Status:** UNSIGNED — pending Program Owner signature  
**Drafted:** 2026-08-05  
**Governing docs:** DEC-IND-011 · `56-producers-p2-execution-plan.md` · MD-1.0 · DD-IND-1.0

---

## Authorization

| Field | Value |
| --- | --- |
| Program | Forge Industrial Safety |
| Pilot tenant (Firebase) | Producers Rice Mill (`business-1782553339499`) |
| Target AWS tenant | **NEW dedicated tenant** (UUID / `tenant_key` TBD at Phase 1 provision — **not** `import-acceptance-tenant-a`) |
| Environment path | Staging-prod dress rehearsal, then production window |
| Staging landing | Same AWS account; staging-prod stack/tenant |
| Hostname | `https://producers-rice-mill.industrial.forgepublicsafety.com/` |
| Effective cutover window | TBD — fill before Phase 5 |

## Day-1 modules (AUTHORIZED)

Personnel · Equipment / Assets · Lockout/Tagout · Sites / Areas · Documents · Training · Forms · Inspections · Incidents · QR Links · Confined Space · Hot Work · Tasks · Messaging · Emergency Response

## Explicitly authorized work

| Workstream | Authorization |
| --- | --- |
| Cognito import | **AUTHORIZED** — full Producers Firebase Auth roster (temp password + force change) |
| Storage → S3 | **AUTHORIZED** — all Producers Firebase Storage objects + Aurora metadata repair |
| Firebase → AWS SoT flip | **AUTHORIZED for Producers only** effective at cutover window below |
| Production Aurora load for Producers | **AUTHORIZED** under Phase 4 freeze + parity gates in plan 56 |

## Explicitly NOT authorized

| Workstream | Status |
| --- | --- |
| Full IND-13 fleet Industrial cutover | NOT AUTHORIZED |
| True dual-write Firebase ↔ Aurora | NOT AUTHORIZED |
| Promote `import-acceptance-tenant-a` to production SoT | NOT AUTHORIZED |
| Casual apply of drafts 0028 / 0029 | NOT AUTHORIZED |
| Academy / RMS scope | NOT AUTHORIZED |

## Preconditions (must be true before Phase 1 execution)

- [ ] This record signed by Program Owner  
- [ ] Support and rollback contacts named  
- [ ] Cutover window agreed with Producers plant ops  

## Signatures

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Program Owner | | | |
| Industrial Product Lead (optional) | | | |
| Platform / Ops Lead (optional) | | | |

## Cutover window (fill before Phase 5)

| Field | Value |
| --- | --- |
| Staging UAT complete date | |
| Production freeze start (UTC) | |
| Production go-live (UTC) | |
| Rollback decision authority | |

## References

- `docs/program/industrial-migration/ind-11/56-producers-p2-execution-plan.md`  
- `docs/program/industrial-migration/ind-11/47-dec-ind-011-producers-coexistence.md`  
- `docs/program/industrial-migration/32-file-migration-plan.md`  
- `docs/program/industrial-migration/33-user-migration-plan.md`  
- `docs/program/industrial-migration/34-cutover-strategy.md`  
