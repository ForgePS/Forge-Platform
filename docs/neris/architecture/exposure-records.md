# Exposure Records

Exposures are repeatable child records of a parent incident (`neris_incident_exposures`).

- Sequential `exposure_number` assigned transaction-safely per incident
- Unique `(incident_id, exposure_number)`
- Location required (address, description, or documented exception)
- Loss/value warnings when loss exceeds value without explanation
- Optional occupancy/preplan links; casualty counts for reconciliation
- Archive/restore; no hard delete after review/finalization path uses archive
- Parent incident totals reconciled via specialty validation
