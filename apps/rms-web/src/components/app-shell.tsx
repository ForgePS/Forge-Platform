"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@forge/web-kit";
import { RmsShellBoundary } from "@/fx/shell/RmsShellBoundary";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RmsShellBoundary>{children}</RmsShellBoundary>
    </AuthProvider>
  );
}
