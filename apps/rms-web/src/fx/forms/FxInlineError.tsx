"use client";

import type { ReactNode } from "react";

export function FxInlineError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className="rms-fx-field__error" role="alert">
      {children}
    </span>
  );
}
