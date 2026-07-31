"use client";

import { FxEmptyState, FxLoadingRegion } from "@forge/fx-ui";

export function FxTableLoading({ label = "Loading table…" }: { label?: string }) {
  return <FxLoadingRegion label={label} />;
}

export function FxTableEmpty({
  title = "No results",
  description = "Try adjusting search or filters.",
}: {
  title?: string;
  description?: string;
}) {
  return <FxEmptyState title={title} description={description} />;
}

export function FxTableError({
  title = "Table unavailable",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rms-fx-table-error" role="alert">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
