"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@forge/web-kit";
import { CreatorShell } from "./creator-shell";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CreatorShell>{children}</CreatorShell>
    </AuthProvider>
  );
}
