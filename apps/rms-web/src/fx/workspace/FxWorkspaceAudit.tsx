"use client";

import type { WorkspaceAuditItem } from "./types";
import { FxWorkspaceEmpty } from "./FxWorkspaceEmpty";

export function FxWorkspaceAudit({ items }: { items: WorkspaceAuditItem[] }) {
  if (items.length === 0) {
    return (
      <FxWorkspaceEmpty
        title="No audit events here"
        description="Audit history remains available on the Review section for authorized users."
      />
    );
  }

  return (
    <section className="rms-fx-workspace-panel" aria-label="Audit history">
      <h2 className="rms-fx-workspace-panel__title">Audit</h2>
      <ul className="rms-fx-workspace-list">
        {items.map((event) => (
          <li key={event.id}>
            <strong>{event.action}</strong>
            <p className="rms-fx-workspace__meta">
              {new Date(event.at).toLocaleString()}
              {event.actor ? ` · ${event.actor}` : ""}
              {event.record ? ` · ${event.record}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
