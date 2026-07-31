"use client";

import type { ReactNode } from "react";

export function FxWorkspaceHeader({
  title,
  identity,
  status,
  actions,
}: {
  title: string;
  identity?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="rms-fx-workspace__header">
      <div className="rms-fx-workspace__header-main">
        {identity}
        <h1 className="rms-fx-workspace__title" aria-labelledby="fx-workspace-context-label">
          {title}
        </h1>
        {status}
      </div>
      {actions ? <div className="rms-fx-workspace__actions">{actions}</div> : null}
    </header>
  );
}
