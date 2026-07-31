import type { ReactNode } from "react";
import { FxSkeleton } from "@forge/fx-ui";

export function DashboardLoadingState({ label = "Loading widget" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="rms-fx-muted" style={{ marginTop: 0 }}>
        {label}…
      </p>
      <FxSkeleton height="4rem" />
    </div>
  );
}

export function DashboardEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div role="status">
      <strong>{title}</strong>
      <p style={{ marginBottom: 0 }}>{description}</p>
    </div>
  );
}

export function DashboardErrorState({
  title = "Unable to load",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div role="alert">
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
