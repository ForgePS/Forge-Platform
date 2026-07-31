"use client";

export function FxWorkspaceLoading({ label = "Loading workspace…" }: { label?: string }) {
  return (
    <div className="rms-fx-workspace-state" role="status" aria-live="polite" aria-busy="true">
      <div className="rms-fx-workspace-skeleton" aria-hidden />
      <p>{label}</p>
    </div>
  );
}
