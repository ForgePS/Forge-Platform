"use client";

import type { WorkspaceAttachmentItem } from "./types";
import { FxWorkspaceEmpty } from "./FxWorkspaceEmpty";

/** Presentation chrome for attachment lists — does not alter storage or upload APIs. */
export function FxWorkspaceAttachments({ items }: { items: WorkspaceAttachmentItem[] }) {
  if (items.length === 0) {
    return (
      <FxWorkspaceEmpty
        title="No attachments listed"
        description="Open the Attachments section to upload, download, preview, or archive using existing APIs."
      />
    );
  }

  return (
    <section className="rms-fx-workspace-panel" aria-label="Attachments">
      <h2 className="rms-fx-workspace-panel__title">Attachments</h2>
      <ul className="rms-fx-workspace-list">
        {items.map((file) => (
          <li key={file.id}>
            {file.href ? <a href={file.href}>{file.name}</a> : <span>{file.name}</span>}
            {file.meta ? <p className="rms-fx-workspace__meta">{file.meta}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
