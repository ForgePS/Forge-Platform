"use client";

import type { ReactNode } from "react";

export function FxWorkspaceSidebar({
  children,
  label = "Workspace sidebar",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <aside className="rms-fx-workspace__sidebar" aria-label={label}>
      {children}
    </aside>
  );
}
