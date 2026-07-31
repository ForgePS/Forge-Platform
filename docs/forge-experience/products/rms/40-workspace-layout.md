# 40 — Workspace Layout

**Date:** 2026-07-30  
**Code:** `apps/rms-web/src/fx/workspace/FxWorkspaceLayout.tsx`

## Structure (fixed)

```text
Breadcrumb
Workspace Header (identity, title, status, actions)
Body
  Main
    Tabs (deep-linked)
    Tab content (product domain panels)
  Sidebar
    Summary
    Timeline
    Related (when available)
    Optional: Notes / Attachments / Audit lists
```

Products hide unused sidebar panels (`showNotes`, `showAttachments`, `showAudit`). Incident hides Notes/Attachments/Audit list duplicates because those experiences already live in section panels (Attachments, Review).
