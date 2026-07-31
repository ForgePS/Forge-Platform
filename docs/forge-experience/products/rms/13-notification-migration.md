# Notification Migration Plan

**Document:** `13-notification-migration.md`  
**Status:** PLANNED

## Current state

No in-app notification center route in `rms-web`. Shell lacks notification entry beyond potential future slot.

## Approach

FX notification presentation around existing sources when available. Distinguish delivery states honestly (in-app, email queued/delivered, SMS, failed, unsupported).

Do not claim channels that backend does not operate.
