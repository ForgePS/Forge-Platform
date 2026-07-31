"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

/** Tenant from query string, falling back to the authenticated session tenant. */
export function useTenantId(): string | null {
  const searchParams = useSearchParams();
  const { me } = useAuth();
  return searchParams.get("tenantId") ?? me?.tenantId ?? null;
}

export function tenantQuery(tenantId: string): string {
  return `?tenantId=${encodeURIComponent(tenantId)}`;
}
