"use client";

import type { WorkspaceNoteItem } from "./types";
import { FxWorkspaceEmpty } from "./FxWorkspaceEmpty";

export function FxWorkspaceNotes({ items }: { items: WorkspaceNoteItem[] }) {
  if (items.length === 0) {
    return (
      <FxWorkspaceEmpty
        title="No notes"
        description="Incident review comments remain on the Review section. A dedicated notes store is not wired."
      />
    );
  }

  return (
    <section className="rms-fx-workspace-panel" aria-label="Notes">
      <h2 className="rms-fx-workspace-panel__title">Notes</h2>
      <ul className="rms-fx-workspace-list">
        {items.map((note) => (
          <li key={note.id}>
            <p>{note.body}</p>
            <p className="rms-fx-workspace__meta">
              {note.author ? `${note.author} · ` : ""}
              {new Date(note.at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
