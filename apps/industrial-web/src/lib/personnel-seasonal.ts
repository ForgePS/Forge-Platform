/** IND-PERSONNEL-SEASONAL-LIFECYCLE-01 — UI helpers and flag gate. */

export const SEASONAL_LIFECYCLE_FLAG = "industrial.personnel.seasonalLifecycle.enabled";

export type SeasonalLifecycleBadgeKind = "pre-hire" | "active-seasonal" | "full-time" | "other";

export type SeasonalLifecycleBadge = {
  label: string;
  kind: SeasonalLifecycleBadgeKind;
};

export function isSeasonalLifecycleEnabled(
  flags: Record<string, boolean> | null | undefined,
): boolean {
  return Boolean(flags?.[SEASONAL_LIFECYCLE_FLAG]);
}

/** Lifecycle badge for roster / detail surfaces. */
export function seasonalLifecycleBadge(row: {
  personStatus?: string | null;
  employmentType?: string | null;
}): SeasonalLifecycleBadge {
  const personStatus = String(row.personStatus ?? "").toUpperCase();
  const employmentType = String(row.employmentType ?? "").toUpperCase();

  if (employmentType === "FULL_TIME") {
    return { label: "Full-time", kind: "full-time" };
  }
  if (personStatus === "PRE_HIRE") {
    return { label: "SEASONAL PRE-HIRE", kind: "pre-hire" };
  }
  if (employmentType === "SEASONAL") {
    return { label: "Active seasonal", kind: "active-seasonal" };
  }
  return { label: employmentType || personStatus || "Unknown", kind: "other" };
}
