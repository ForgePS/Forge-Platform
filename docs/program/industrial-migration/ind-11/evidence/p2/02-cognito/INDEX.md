# Phase 2 Cognito evidence index

**Status:** Staging Cognito create + Aurora link complete for freeze roster  
**Prep:** `../../59-producers-p2-phase2-prep.md`

| Artifact | Purpose |
| --- | --- |
| `APPROVE-PRODUCERS-AUTH-EXPORT.md` | Gate for read-only Firebase Auth list — **SIGNED** |
| `roster-export-2026-08-05T20-16-50-164Z.json` | Freeze file (6 Producers users) |
| `roster-export-latest.json` | Latest freeze alias |
| `roster-count-summary.json` | Counts + exceptions |
| `roster-map-plan.json` | Cognito create / membership plan |
| `APPROVE-PRODUCERS-COGNITO-CREATE.md` | Gate for AdminCreateUser — **SIGNED** (staging) |
| `cognito-create-staging-result.json` | Create evidence (no passwords) |
| `link-staging-payload.json` | Subjects linked (no passwords) |
| `link-staging-roster-result.json` | Aurora link evidence |
| `login-smoke-staging.json` | Role-template smoke (pending) |

**Freeze counts (2026-08-05T20:16:50Z):** Auth total 10 · Producers matched **6**

**Staging create (2026-08-05T20:32:53Z):** Cognito created 4 · linked existing 1 · passwords issued 4 (local `~/.forge/producers-p2/` only) · Aurora linked **6/6**

**Temp passwords:** never committed — see local `~/.forge/producers-p2/staging-temp-passwords-*.json`
