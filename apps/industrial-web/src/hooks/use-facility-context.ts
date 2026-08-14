"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@forge/web-kit";

const STORAGE_KEY = "forge-industrial-facility-id";

export type IndustrialSiteOption = {
  id: string;
  name: string;
};

/**
 * Company-level location context for Industrial Safety.
 * "all" = company-wide view (users with company access).
 */
export function useFacilityContext(tenantId: string | null | undefined) {
  const [sites, setSites] = useState<IndustrialSiteOption[]>([]);
  const [facilityId, setFacilityIdState] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setSites([]);
      setFacilityIdState("all");
      return;
    }
    const stored = sessionStorage.getItem(`${STORAGE_KEY}:${tenantId}`);
    if (stored) setFacilityIdState(stored);
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await apiGet<{ items?: Array<{ id: string; name?: string; displayName?: string }> }>(
          "/api/v1/industrial/sites",
        );
        if (cancelled) return;
        const items = (data.items ?? []).map((s) => ({
          id: s.id,
          name: s.name ?? s.displayName ?? "Location",
        }));
        setSites(items);
        if (stored && stored !== "all" && !items.some((s) => s.id === stored)) {
          setFacilityIdState("all");
          sessionStorage.setItem(`${STORAGE_KEY}:${tenantId}`, "all");
        }
      } catch {
        if (!cancelled) setSites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const setFacilityId = useCallback(
    (next: string) => {
      setFacilityIdState(next);
      if (tenantId) sessionStorage.setItem(`${STORAGE_KEY}:${tenantId}`, next);
    },
    [tenantId],
  );

  const selectedLabel =
    facilityId === "all"
      ? "All Locations"
      : (sites.find((s) => s.id === facilityId)?.name ?? "Location");

  return { sites, facilityId, setFacilityId, selectedLabel, loading };
}
