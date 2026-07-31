# Property, Occupancy, and Preplan Integration

`neris_incident_occupancy_links` stores an incident-time snapshot of occupancy/preplan data plus optional incident-specific corrections. Master records are never auto-modified.

## Proposed master updates

`neris_proposed_master_updates` workflow statuses:

`PROPOSED` → `UNDER_REVIEW` → `ACCEPTED` | `REJECTED` → `APPLIED`

Applying requires `rms.masterdata.manage` (Prevention/configuration permission). Prefill continues to use existing `GET …/prefill` candidates.
