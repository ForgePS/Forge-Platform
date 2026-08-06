"use client";

import { configureApiClient } from "@forge/web-kit";

const allowDevPrincipal = process.env.NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL === "true";

// Configure synchronously at module load so AuthProvider's first /auth/me
// call does not race against a useEffect and hit the localhost default.
configureApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  ...(allowDevPrincipal && process.env.NEXT_PUBLIC_DEV_PRINCIPAL
    ? { devPrincipalEnv: process.env.NEXT_PUBLIC_DEV_PRINCIPAL }
    : {}),
});

export function ApiBootstrap({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
