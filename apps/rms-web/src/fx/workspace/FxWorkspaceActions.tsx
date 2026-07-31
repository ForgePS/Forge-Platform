"use client";

import type { ReactNode } from "react";
import type { WorkspaceAction } from "./types";

export function FxWorkspaceActions({
  actions,
  children,
}: {
  actions?: WorkspaceAction[];
  children?: ReactNode;
}) {
  return (
    <div className="rms-fx-workspace__actions" role="group" aria-label="Workspace actions">
      {children}
      {actions?.map((action) => {
        if (action.href) {
          return (
            <a
              key={action.id}
              href={action.href}
              className="rms-fx-workspace__action"
              aria-disabled={action.disabled || undefined}
            >
              {action.label}
            </a>
          );
        }
        return (
          <button
            key={action.id}
            type="button"
            className="rms-fx-workspace__action"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
