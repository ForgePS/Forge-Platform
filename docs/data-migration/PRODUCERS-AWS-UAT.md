# PRODUCERS — AWS UAT (CONTROLLED-AURORA-IMPORT-S1)

**Status:** NOT COMPLETE  
**Context:** Platform Admin / support only — no customer DNS change.

## Preconditions met for UAT

- Schema `0040_industrial_domain_s1` deployed  
- RLS + WC medical GUC synthetic tests **PASS**  
- Partial Producers data present under tenant `019ff7d0-c20f-7659-81e4-c0cd68e23262`  
- API service on industrial image revision `:11`

## Module matrix

Deferred until import residuals cleared (QR versions, attachments, EHS versions).

| MODULE | LIST_LOAD | DETAIL_LOAD | TENANT_SCOPE | COUNT_SANITY | ATTACHMENT_SANITY | STATUS |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | — | — | — | — | — | NOT RUN |
| Personnel | — | — | — | — | — | NOT RUN |
| … | — | — | — | — | — | NOT RUN |

## Security UAT

| Gate | Status |
| --- | --- |
| Pre-import WC medical synthetic | PASS |
| Post-import WC_SECURITY_UAT | NOT RUN |
| POST_IMPORT_CROSS_TENANT_READ | NOT RUN (pre-import DENIED) |
| POST_IMPORT_CROSS_TENANT_WRITE | NOT RUN (pre-import DENIED) |

## Auth policy

`CUSTOMER_COGNITO_MIGRATION`: **NOT RUN** (Personnel ≠ Cognito users).
