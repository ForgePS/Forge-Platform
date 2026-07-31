# 10 — Rollback Plan

Each module rolls back independently by disabling its module flag (clear env/session overrides).

Preserve route, query, record id, drafts, autosave keys, session, tenant, attachments, audit, filters/sort/page where practical.

Legacy implementations are **not** removed during S2F.

S2F-3: disabling `fx.rms.module.cadMessages.enabled` restores legacy messages table only.

S2F-4: disabling `fx.rms.module.cadConnections.enabled` restores legacy create form + connections table only.

S2F-5: disabling `fx.rms.module.cadConflicts.enabled` restores legacy conflicts table only.

S2F-6: disabling `fx.rms.module.nerisConfiguration.enabled` restores legacy configuration forms only.

S2F-7: disabling administration / utilities flags restores legacy select-tenant / health independently.
