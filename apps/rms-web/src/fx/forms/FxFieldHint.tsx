"use client";

import type { ReactNode } from "react";

export function FxFieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className="rms-fx-field__hint">
      {children}
    </span>
  );
}
