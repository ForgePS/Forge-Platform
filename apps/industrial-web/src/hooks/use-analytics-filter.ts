"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalyticsFilterContext } from "@forge/contracts";

const FILTER_STORAGE_KEY = "forge-ind-analytics-filter";
const DOMAIN_STORAGE_KEY = "forge-ind-analytics-domain";
const VIEWS_STORAGE_KEY = "forge-ind-analytics-saved-views";
const MAX_SAVED_VIEWS = 20;

export type AnalyticsPanel =
  | "overview"
  | "incidents"
  | "inspections"
  | "personnel"
  | "loto"
  | "dot"
  | "workers-comp"
  | "intelligence";

export type AnalyticsSavedView = {
  id: string;
  name: string;
  panel: AnalyticsPanel;
  filter: Pick<
    AnalyticsFilterContext,
    "from" | "to" | "severity" | "status" | "facilityId" | "departmentId"
  >;
  createdAt: string;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): Pick<AnalyticsFilterContext, "from" | "to"> {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}

function emptyExtras(): Pick<
  AnalyticsFilterContext,
  "severity" | "status" | "facilityId" | "departmentId"
> {
  return { severity: null, status: null, facilityId: null, departmentId: null };
}

function isPanel(value: unknown): value is AnalyticsPanel {
  return (
    value === "incidents" ||
    value === "overview" ||
    value === "inspections" ||
    value === "personnel" ||
    value === "loto" ||
    value === "dot" ||
    value === "workers-comp" ||
    value === "intelligence"
  );
}

function readStoredFilter(): AnalyticsFilterContext {
  const range = defaultRange();
  if (typeof window === "undefined") return { ...range, ...emptyExtras() };
  try {
    const raw = window.sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return { ...range, ...emptyExtras() };
    const parsed = JSON.parse(raw) as Partial<AnalyticsFilterContext>;
    return {
      from: parsed.from && /^\d{4}-\d{2}-\d{2}$/.test(parsed.from) ? parsed.from : range.from,
      to: parsed.to && /^\d{4}-\d{2}-\d{2}$/.test(parsed.to) ? parsed.to : range.to,
      severity: parsed.severity ? String(parsed.severity) : null,
      status: parsed.status ? String(parsed.status) : null,
      facilityId: parsed.facilityId ? String(parsed.facilityId) : null,
      departmentId: parsed.departmentId ? String(parsed.departmentId) : null,
    };
  } catch {
    return { ...range, ...emptyExtras() };
  }
}

function readStoredDomain(): AnalyticsPanel {
  if (typeof window === "undefined") return "overview";
  try {
    const raw = window.sessionStorage.getItem(DOMAIN_STORAGE_KEY);
    if (isPanel(raw)) return raw;
  } catch {
    // ignore
  }
  return "overview";
}

function readStoredViews(): AnalyticsSavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is AnalyticsSavedView => {
        if (!v || typeof v !== "object") return false;
        const row = v as Partial<AnalyticsSavedView>;
        return (
          typeof row.id === "string" &&
          typeof row.name === "string" &&
          isPanel(row.panel) &&
          !!row.filter &&
          typeof row.filter.from === "string" &&
          typeof row.filter.to === "string"
        );
      })
      .slice(0, MAX_SAVED_VIEWS);
  } catch {
    return [];
  }
}

function snapshotFilter(
  filter: AnalyticsFilterContext,
): AnalyticsSavedView["filter"] {
  return {
    from: filter.from,
    to: filter.to,
    severity: filter.severity || null,
    status: filter.status || null,
    facilityId: filter.facilityId || null,
    departmentId: filter.departmentId || null,
  };
}

/** Build query string for analytics GET routes from shared filter context. */
export function analyticsFilterQuery(filter: AnalyticsFilterContext): string {
  const qs = new URLSearchParams();
  qs.set("from", filter.from);
  qs.set("to", filter.to);
  if (filter.severity) qs.set("severity", filter.severity);
  if (filter.status) qs.set("status", filter.status);
  if (filter.facilityId) qs.set("facilityId", filter.facilityId);
  if (filter.departmentId) qs.set("departmentId", filter.departmentId);
  if (filter.companyId) qs.set("companyId", filter.companyId);
  return qs.toString();
}

/**
 * Shared Analytics filter context — persists across domains via sessionStorage.
 * Named views are session-local until server CRUD / GAP views land.
 */
export function useAnalyticsFilter() {
  const [filter, setFilterState] = useState<AnalyticsFilterContext>(() => ({
    ...defaultRange(),
    ...emptyExtras(),
  }));
  const [panel, setPanelState] = useState<AnalyticsPanel>("overview");
  const [savedViews, setSavedViews] = useState<AnalyticsSavedView[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFilterState(readStoredFilter());
    setPanelState(readStoredDomain());
    setSavedViews(readStoredViews());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: AnalyticsFilterContext, nextPanel: AnalyticsPanel) => {
    try {
      window.sessionStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          from: next.from,
          to: next.to,
          severity: next.severity || null,
          status: next.status || null,
          facilityId: next.facilityId || null,
          departmentId: next.departmentId || null,
        }),
      );
      window.sessionStorage.setItem(DOMAIN_STORAGE_KEY, nextPanel);
    } catch {
      // ignore
    }
  }, []);

  const persistViews = useCallback((views: AnalyticsSavedView[]) => {
    try {
      window.sessionStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(views.slice(0, MAX_SAVED_VIEWS)));
    } catch {
      // ignore
    }
  }, []);

  const setFilter = useCallback(
    (patch: Partial<AnalyticsFilterContext>) => {
      setFilterState((prev) => {
        const clearable = (value: string | null | undefined, fallback: string | null) =>
          value === "" ? null : value !== undefined ? value : fallback;
        const next: AnalyticsFilterContext = {
          ...prev,
          ...patch,
          severity: clearable(patch.severity, prev.severity ?? null),
          status: clearable(patch.status, prev.status ?? null),
          facilityId: clearable(patch.facilityId, prev.facilityId ?? null),
          departmentId: clearable(patch.departmentId, prev.departmentId ?? null),
        };
        persist(next, panel);
        return next;
      });
    },
    [panel, persist],
  );

  const setPanel = useCallback(
    (next: AnalyticsPanel) => {
      setPanelState(next);
      persist(filter, next);
    },
    [filter, persist],
  );

  const applyFilter = useCallback(
    (next: AnalyticsFilterContext) => {
      const normalized: AnalyticsFilterContext = {
        ...next,
        severity: next.severity || null,
        status: next.status || null,
        facilityId: next.facilityId || null,
        departmentId: next.departmentId || null,
      };
      setFilterState(normalized);
      persist(normalized, panel);
    },
    [panel, persist],
  );

  const saveView = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const view: AnalyticsSavedView = {
        id: `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed.slice(0, 80),
        panel,
        filter: snapshotFilter(filter),
        createdAt: new Date().toISOString(),
      };
      setSavedViews((prev) => {
        const next = [view, ...prev.filter((v) => v.name.toLowerCase() !== view.name.toLowerCase())].slice(
          0,
          MAX_SAVED_VIEWS,
        );
        persistViews(next);
        return next;
      });
      return view;
    },
    [filter, panel, persistViews],
  );

  const applySavedView = useCallback(
    (id: string) => {
      const view = savedViews.find((v) => v.id === id);
      if (!view) return;
      const nextFilter: AnalyticsFilterContext = {
        ...filter,
        ...view.filter,
        severity: view.filter.severity || null,
        status: view.filter.status || null,
        facilityId: view.filter.facilityId || null,
        departmentId: view.filter.departmentId || null,
      };
      setFilterState(nextFilter);
      setPanelState(view.panel);
      persist(nextFilter, view.panel);
    },
    [filter, persist, savedViews],
  );

  const deleteSavedView = useCallback(
    (id: string) => {
      setSavedViews((prev) => {
        const next = prev.filter((v) => v.id !== id);
        persistViews(next);
        return next;
      });
    },
    [persistViews],
  );

  return {
    filter,
    panel,
    hydrated,
    savedViews,
    setFilter,
    setPanel,
    applyFilter,
    saveView,
    applySavedView,
    deleteSavedView,
    queryString: analyticsFilterQuery(filter),
  };
}
