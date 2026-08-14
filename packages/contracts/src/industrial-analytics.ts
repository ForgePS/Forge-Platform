/**
 * Industrial Analytics contracts — shared filter context + overview DTOs.
 * Domain results extend these envelopes as Phase B lands.
 */

export const INDUSTRIAL_ANALYTICS_DOMAINS = [
  "overview",
  "loto",
  "dot",
  "personnel",
  "incidents",
  "inspections",
  "workers-comp",
  "intelligence",
] as const;

export type IndustrialAnalyticsDomain = (typeof INDUSTRIAL_ANALYTICS_DOMAINS)[number];

/** Global filter context — persist across domain navigation. */
export type AnalyticsFilterContext = {
  companyId?: string | null;
  facilityId?: string | null;
  buildingId?: string | null;
  areaId?: string | null;
  locationId?: string | null;
  departmentId?: string | null;
  shift?: string | null;
  supervisorId?: string | null;
  employeeId?: string | null;
  positionId?: string | null;
  contractorId?: string | null;
  /** Inclusive ISO date (YYYY-MM-DD). */
  from: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  to: string;
  severity?: string | null;
  status?: string | null;
};

/** Progressive Phase C filter options (Bridge chart dims → AWS filters). */
export const ANALYTICS_SEVERITY_OPTIONS = [
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "serious", label: "Serious" },
  { value: "critical", label: "Critical" },
] as const;

export const ANALYTICS_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "under-review", label: "Under review" },
  { value: "closed", label: "Closed" },
  { value: "pending", label: "Pending" },
  { value: "draft", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
] as const;

/** Distinct facility/department labels for shared filter dropdowns. */
export type AnalyticsFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type AnalyticsFilterOptions = {
  domain: "filter-options";
  generatedAt: string;
  filter: Pick<AnalyticsFilterContext, "from" | "to">;
  facilities: AnalyticsFilterOption[];
  departments: AnalyticsFilterOption[];
  warnings: string[];
};

export type AnalyticsCompareMode = "previous_period" | "year_over_year" | "custom";

export type AnalyticsQuery = AnalyticsFilterContext & {
  compare?: AnalyticsCompareMode;
  compareFrom?: string;
  compareTo?: string;
  groupBy?: string[];
  sortField?: string;
  sortDir?: "asc" | "desc";
  viewId?: string;
  cursor?: string;
  limit?: number;
};

export type AnalyticsKpi = {
  id: string;
  label: string;
  value: number | string | null;
  unit?: string;
  /** Relative change vs compare window when computed (fraction, e.g. 0.12 = +12%). */
  delta?: number | null;
  accent?: "default" | "warning" | "danger" | "success";
  /** Drill-through hint for UI. */
  drillDomain?: IndustrialAnalyticsDomain;
  drillFilters?: Partial<AnalyticsFilterContext>;
};

export type AnalyticsSeriesPoint = {
  bucket: string;
  value: number;
  label?: string;
};

export type AnalyticsNamedCount = {
  key: string;
  label: string;
  count: number;
};

export type AnalyticsLink = {
  rel: string;
  module: string;
  id: string;
  href: string;
  label: string;
};

export type AnalyticsModuleActivity = {
  module: string;
  label: string;
  inRange: number;
  open?: number;
};

/**
 * Executive / Dashboard overview — Phase A.
 * Values MUST come from tenant-scoped queries (never hard-coded demo stats).
 */
export type AnalyticsOverview = {
  domain: "overview";
  generatedAt: string;
  filter: AnalyticsFilterContext;
  compare?: {
    mode: AnalyticsCompareMode;
    from: string;
    to: string;
  };
  safetyScore: number | null;
  safetyGrade: string | null;
  kpis: AnalyticsKpi[];
  moduleActivity: AnalyticsModuleActivity[];
  incidentTrend: AnalyticsSeriesPoint[];
  inspectionTrend: AnalyticsSeriesPoint[];
  observationsTrend: AnalyticsSeriesPoint[];
  incidentsByCategory: AnalyticsNamedCount[];
  inspectionsBySite: AnalyticsNamedCount[];
  /** Present when domain not yet aggregating; empty when overview is live. */
  warnings: string[];
  links: AnalyticsLink[];
};

/**
 * Incidents domain — Phase B.
 * Open-incident KPIs are current (not date-scoped); range KPIs use dateOccurred|incidentDate|createdAt.
 */
export type AnalyticsBodyPartCount = {
  bodyPart: string;
  count: number;
};

export type AnalyticsIncidents = {
  domain: "incidents";
  generatedAt: string;
  filter: AnalyticsFilterContext;
  compare?: {
    mode: AnalyticsCompareMode;
    from: string;
    to: string;
  };
  kpis: AnalyticsKpi[];
  incidentTrend: AnalyticsSeriesPoint[];
  byCategory: AnalyticsNamedCount[];
  bySeverity: AnalyticsNamedCount[];
  injuriesByBodyPart: AnalyticsBodyPartCount[];
  /** Cap ~25 newest in-range incidents for drill-through. */
  recent: AnalyticsLink[];
  warnings: string[];
};

/**
 * Inspections domain — Phase B.
 * Range KPIs use inspectionDate|createdAt; score averages payload.score where score>0.
 */
export type AnalyticsInspections = {
  domain: "inspections";
  generatedAt: string;
  filter: AnalyticsFilterContext;
  compare?: {
    mode: AnalyticsCompareMode;
    from: string;
    to: string;
  };
  kpis: AnalyticsKpi[];
  inspectionTrend: AnalyticsSeriesPoint[];
  bySite: AnalyticsNamedCount[];
  byStatus: AnalyticsNamedCount[];
  /** Cap ~25 newest in-range inspections for drill-through. */
  recent: AnalyticsLink[];
  warnings: string[];
};

/**
 * Personnel / training domain — Phase B (org-level).
 * Training range KPIs use completedAt|dueDate|enrolledAt|createdAt on module=training.
 * Person-scoped Bridge PER-* panel remains deferred (profile module).
 */
export type AnalyticsPersonnel = {
  domain: "personnel";
  generatedAt: string;
  filter: AnalyticsFilterContext;
  compare?: {
    mode: AnalyticsCompareMode;
    from: string;
    to: string;
  };
  kpis: AnalyticsKpi[];
  trainingTrend: AnalyticsSeriesPoint[];
  byStatus: AnalyticsNamedCount[];
  /** Cap ~25 newest in-range training/personnel activity links. */
  recent: AnalyticsLink[];
  warnings: string[];
};

/**
 * LOTO domain — Phase B (dedicated Lockout/Tagout slice of enterprise registry).
 * Range activity uses eventDate|dueDate|updatedAt|createdAt; open = ATTENTION-like statuses.
 */
export type AnalyticsLoto = {
  domain: "loto";
  generatedAt: string;
  filter: AnalyticsFilterContext;
  compare?: {
    mode: AnalyticsCompareMode;
    from: string;
    to: string;
  };
  kpis: AnalyticsKpi[];
  activityTrend: AnalyticsSeriesPoint[];
  byStatus: AnalyticsNamedCount[];
  bySite: AnalyticsNamedCount[];
  byCategory: AnalyticsNamedCount[];
  /** Cap ~25 newest in-range LOTO records. */
  recent: AnalyticsLink[];
  warnings: string[];
};

/**
 * DOT Compliance domain — Phase B.
 * Compliance **score** uses all non-archived DOT rows (Bridge parity: not date-scoped).
 * Activity / open-in-range use updatedAt|createdAt within the filter window.
 */
export type AnalyticsDot = {
  domain: "dot";
  generatedAt: string;
  filter: AnalyticsFilterContext;
  compare?: {
    mode: AnalyticsCompareMode;
    from: string;
    to: string;
  };
  kpis: AnalyticsKpi[];
  activityTrend: AnalyticsSeriesPoint[];
  byCategory: AnalyticsNamedCount[];
  byStatus: AnalyticsNamedCount[];
  fleetBreakdown: AnalyticsNamedCount[];
  recent: AnalyticsLink[];
  warnings: string[];
};

/**
 * Workers' Comp domain — Phase B.
 * Open KPIs are current (not date-scoped); range volume uses intake.incidentDate|incidentDate|createdAt.
 * Claim $ / incurred KPIs omitted until WC cost field policy is decided (plan #326).
 */
export type AnalyticsWorkersComp = {
  domain: "workers-comp";
  generatedAt: string;
  filter: AnalyticsFilterContext;
  compare?: {
    mode: AnalyticsCompareMode;
    from: string;
    to: string;
  };
  kpis: AnalyticsKpi[];
  injuryTrend: AnalyticsSeriesPoint[];
  byStatus: AnalyticsNamedCount[];
  byDepartment: AnalyticsNamedCount[];
  byFacility: AnalyticsNamedCount[];
  byInjuryType: AnalyticsNamedCount[];
  byBodyPart: AnalyticsNamedCount[];
  byWorkStatus: AnalyticsNamedCount[];
  byAging: AnalyticsNamedCount[];
  recent: AnalyticsLink[];
  warnings: string[];
};

/**
 * Cross-module Intelligence — Phase B.
 * Findings must cite evidence (counts/windows/sample refs). No unsupported generative conclusions.
 */
export type AnalyticsEvidenceRef = {
  kind: "count" | "kpi" | "module" | "record" | "window";
  id?: string;
  module?: string;
  label: string;
  value?: number | string | null;
  href?: string;
};

export type AnalyticsFinding = {
  id: string;
  severity: "info" | "attention" | "critical";
  /** Paraphrase of evidence only — must be supported by `evidence`. */
  summary: string;
  evidence: AnalyticsEvidenceRef[];
  drillDomain?: IndustrialAnalyticsDomain;
};

export type AnalyticsIntelligence = {
  domain: "intelligence";
  generatedAt: string;
  filter: AnalyticsFilterContext;
  compare?: {
    mode: AnalyticsCompareMode;
    from: string;
    to: string;
  };
  kpis: AnalyticsKpi[];
  moduleActivity: AnalyticsModuleActivity[];
  findings: AnalyticsFinding[];
  injuriesByBodyPart: AnalyticsBodyPartCount[];
  topCategories: AnalyticsNamedCount[];
  recentAttention: AnalyticsLink[];
  warnings: string[];
};

export type AnalyticsDomainStub = {
  domain: IndustrialAnalyticsDomain;
  status: "NOT_IMPLEMENTED";
  message: string;
  filter: AnalyticsFilterContext;
};
