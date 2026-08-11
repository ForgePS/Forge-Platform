# PROD-S0R — SES production readiness

**Account:** `511343547817` · **Region:** `us-east-1`  
**Configured send domain:** `mail.forgepublicsafety.com`  
**Bulk customer mail:** NOT AUTHORIZED

## Account posture

| Check | Result |
| --- | --- |
| Sending enabled | true |
| Production access (out of sandbox) | **false — still SES sandbox** |
| Enforcement | HEALTHY |

## Gaps

1. No CDK `EmailIdentity` / DKIM / MAIL FROM resources yet.
2. Platform email provider still defaults to noop; SES provider requires an injected send function.
3. Bounce/complaint → SNS wiring will use `Forge-Production-Alerting` topic `forge-production-sns-ses-events` once SES identities exist.
4. Leaving the SES sandbox requires an AWS production-access request that **cannot** be completed automatically in this sprint.

## Classification

**SES = READY WITH CONDITIONS**

Conditions / blockers for production email:

- Submit / approve SES production access request with AWS.
- Create and DNS-validate domain identity for `mail.forgepublicsafety.com` (DKIM CNAMEs) without changing application traffic records.
- Wire `FORGE_EMAIL_PROVIDER=ses` and task IAM only when Compute is authorized.
- Confirm SNS bounce/complaint handling endpoints.
