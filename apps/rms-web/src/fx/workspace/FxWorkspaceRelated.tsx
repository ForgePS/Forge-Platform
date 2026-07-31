"use client";

import type { WorkspaceRelatedItem } from "./types";
import { FxWorkspaceEmpty } from "./FxWorkspaceEmpty";

export function FxWorkspaceRelated({ items }: { items: WorkspaceRelatedItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rms-fx-workspace-panel" aria-label="Related records">
      <h2 className="rms-fx-workspace-panel__title">Related</h2>
      <ul className="rms-fx-workspace-list">
        {items.map((item) => (
          <li key={item.id}>
            {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
            {item.meta ? <p className="rms-fx-workspace__meta">{item.meta}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FxWorkspaceRelatedEmpty() {
  return (
    <FxWorkspaceEmpty
      title="No related records"
      description="Only relationships already available on the record are shown."
    />
  );
}
