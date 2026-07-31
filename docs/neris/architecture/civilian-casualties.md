# Civilian Casualty Records

Table: `neris_incident_civilian_casualties`.

- Supports known and unknown persons (unknown requires `unknownPersonHandling`)
- No ePCR clinical documentation stored; optional `epcrEncounterRef` for future linking only
- List views mask display names unless `full=true` with `rms.neris.civilian_casualty.view`
- Access audited in `neris_casualty_access_audit` without restricted payload content
- Fatality requires severity + outcome (validation)
- Transport requires destination or exception when transport status indicates transport
