"use client";

import type { ReactNode } from "react";
import { useRmsFxFlags } from "../flags/use-rms-fx-flags";
import { RmsFxShell } from "./RmsFxShell";
import { RmsLegacyShellAdapter } from "./RmsLegacyShellAdapter";

/**
 * Selects legacy vs FX shell from presentation flags.
 * Fail-safe: loading or flags off → legacy shell.
 */
export function RmsShellBoundary({ children }: { children: ReactNode }) {
  const presentation = useRmsFxFlags();

  if (presentation.loading || !presentation.shellEnabled) {
    return <RmsLegacyShellAdapter>{children}</RmsLegacyShellAdapter>;
  }

  return <RmsFxShell presentation={presentation}>{children}</RmsFxShell>;
}

/** Named adapter export for registry / docs. */
export function RmsFxShellAdapter({ children }: { children: ReactNode }) {
  return <RmsShellBoundary>{children}</RmsShellBoundary>;
}
