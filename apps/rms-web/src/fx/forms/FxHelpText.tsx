"use client";

import type { ReactNode } from "react";

export function FxHelpText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="rms-fx-field__help">
      {children}
    </p>
  );
}
