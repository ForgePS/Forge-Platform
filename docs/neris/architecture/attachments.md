# Incident Attachments (Phase 3)

Attachments use `forge_documents` (binary metadata + tenant-scoped S3 object key) and `neris_incident_attachments` (incident/specialty linkage).

## Storage

- Bucket: `S3_DOCUMENT_BUCKET` (existing Forge documents bucket)
- Key pattern: `tenants/{tenantId}/incidents/{incidentId}/documents/{storedFilename}`
- Pre-signed PUT uploads, 15-minute expiry
- No public bucket access
- Archive soft-deletes metadata; objects are retained per retention rule

## Malware scanning

Interface: `MalwareScanner` (`malware-scan.interface.ts`).

Default implementation: `QuarantineDefaultMalwareScanner` — when no scanner is deployed, uploads complete as **QUARANTINED** and `clearedForUse` remains false. Never report CLEARED without a real scan.

## Upload flow

1. `POST …/attachments/uploads` — validate type/size, create rows, return pre-signed URL
2. Client PUTs bytes to S3 (progress + retry on client)
3. `POST …/attachments/{id}/complete` — checksum check, invoke scanner, mark COMPLETE

## Categories

Scene/fire/hazmat/rescue/explosion/exposure photos, alarm and protection documents, investigation referrals, sketches, floor plans, PDFs, other.
