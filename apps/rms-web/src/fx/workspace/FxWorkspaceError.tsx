"use client";

export function FxWorkspaceError({
  title = "Something went wrong",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rms-fx-workspace-state rms-fx-workspace-state--error" role="alert">
      <h3 className="rms-fx-workspace-state__title">{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
