"use client";

import type { WorkspaceTimelineItem } from "./types";
import { FxWorkspaceEmpty } from "./FxWorkspaceEmpty";

export function FxWorkspaceTimeline({ items }: { items: WorkspaceTimelineItem[] }) {
  if (items.length === 0) {
    return (
      <FxWorkspaceEmpty
        title="No timeline events"
        description="Timeline shows existing record events only. Full history remains on the Review section when available."
      />
    );
  }

  return (
    <section className="rms-fx-workspace-panel" aria-label="Timeline">
      <h2 className="rms-fx-workspace-panel__title">Timeline</h2>
      <ol className="rms-fx-workspace-timeline">
        {items.map((item) => (
          <li key={item.id} className="rms-fx-workspace-timeline__item">
            <time dateTime={item.at}>{new Date(item.at).toLocaleString()}</time>
            <div>
              <strong>{item.label}</strong>
              {item.actor ? <span className="rms-fx-workspace__meta"> · {item.actor}</span> : null}
              {item.detail ? <p className="rms-fx-workspace__meta">{item.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
