"use client";

import { FxEmptyState, FxLoadingRegion } from "@forge/fx-ui";

export function FxFormLoading({ label = "Loading form…" }: { label?: string }) {
  return <FxLoadingRegion label={label} />;
}

export function FxFormEmpty({
  title = "Nothing to show",
  description = "This form has no fields for the current context.",
}: {
  title?: string;
  description?: string;
}) {
  return <FxEmptyState title={title} description={description} />;
}

export function FxFormError({
  title = "Form unavailable",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rms-fx-form-error" role="alert">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
