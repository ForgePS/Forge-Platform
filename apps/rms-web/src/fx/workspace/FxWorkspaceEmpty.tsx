"use client";

export function FxWorkspaceEmpty({
  title = "Nothing to show",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rms-fx-workspace-state" role="status">
      <h3 className="rms-fx-workspace-state__title">{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
