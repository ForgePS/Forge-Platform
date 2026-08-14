import { Inject, Injectable } from "@nestjs/common";
import {
  type AnalyticsDomainStub,
  type AnalyticsFilterContext,
  type AnalyticsIncidents,
  type AnalyticsInspections,
  type AnalyticsPersonnel,
  type AnalyticsLoto,
  type AnalyticsDot,
  type AnalyticsWorkersComp,
  type AnalyticsIntelligence,
  type AnalyticsFinding,
  type AnalyticsFilterOptions,
  type AnalyticsBodyPartCount,
  type AnalyticsLink,
  type AnalyticsModuleActivity,
  type AnalyticsNamedCount,
  type AnalyticsOverview,
  type AnalyticsSeriesPoint,
  type IndustrialAnalyticsDomain,
  INDUSTRIAL_PRODUCT_CODE,
} from "@forge/contracts";
import { industrialOpsRecords, type Database, withTenantTransaction } from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

const OPENISH = new Set([
  "open",
  "OPEN",
  "under-review",
  "UNDER_REVIEW",
  "pending",
  "PENDING",
  "draft",
  "DRAFT",
  "ACTIVE",
  "active",
]);

const CATEGORY_LABELS: Record<string, string> = {
  injuries: "Injuries",
  "near-misses": "Near Misses",
  "medical-refusals": "Medical Refusals",
  "property-damage": "Property Damage",
  automotive: "Automotive",
  uncategorized: "Uncategorized",
};

const SEVERITY_LABELS: Record<string, string> = {
  minor: "Minor",
  moderate: "Moderate",
  serious: "Serious",
  critical: "Critical",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(value: string | undefined, fallback: Date): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function endOfDayUtc(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

function defaultFilter(query: Record<string, string | undefined>): AnalyticsFilterContext {
  const to = parseDay(query.to, new Date());
  const fromDefault = new Date(to);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 29);
  const from = parseDay(query.from, fromDefault);
  return {
    from: isoDate(from),
    to: isoDate(to),
    companyId: query.companyId || null,
    facilityId: query.facilityId || null,
    buildingId: query.buildingId || null,
    areaId: query.areaId || null,
    locationId: query.locationId || null,
    departmentId: query.departmentId || null,
    shift: query.shift || null,
    supervisorId: query.supervisorId || null,
    employeeId: query.employeeId || null,
    positionId: query.positionId || null,
    contractorId: query.contractorId || null,
    severity: query.severity || null,
    status: query.status || null,
  };
}

function safetyGrade(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function asPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Bridge parity: dateOccurred | incidentDate | createdAt. */
function incidentEventAt(
  payload: Record<string, unknown>,
  createdAt: Date,
): Date {
  for (const key of ["dateOccurred", "incidentDate", "eventDate", "occurredAt"] as const) {
    const raw = payload[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return createdAt;
}

/** Bridge parity: inspectionDate | createdAt. */
function inspectionEventAt(
  payload: Record<string, unknown>,
  createdAt: Date,
): Date {
  for (const key of ["inspectionDate", "eventDate", "completedAt"] as const) {
    const raw = payload[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return createdAt;
}

/** Bridge parity: completedAt | dueDate | enrolledAt | createdAt. */
function trainingEventAt(
  payload: Record<string, unknown>,
  createdAt: Date,
): Date {
  for (const key of ["completedAt", "dueDate", "enrolledAt", "eventDate"] as const) {
    const raw = payload[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return createdAt;
}

/** Bridge enterprise registry: updatedAt | eventDate | createdAt (+ dueDate for expiry). */
function lotoEventAt(
  payload: Record<string, unknown>,
  createdAt: Date,
  updatedAt?: Date,
): Date {
  for (const key of ["eventDate", "dueDate", "updatedAt"] as const) {
    const raw = payload[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) return updatedAt;
  return createdAt;
}

const LOTO_ATTENTION = new Set([
  ...OPENISH,
  "non-compliant",
  "NON_COMPLIANT",
  "expired",
  "EXPIRED",
  "out-of-service",
  "OUT_OF_SERVICE",
  "overdue",
  "OVERDUE",
]);

const DOT_OPEN = new Set(["open", "pending", "non-compliant", "expired", "OPEN", "PENDING", "NON_COMPLIANT", "EXPIRED"]);
const DOT_COMPLIANT = new Set(["compliant", "closed", "COMPLIANT", "CLOSED"]);
const DOT_TRACKED = new Set(["drivers", "vehicles"]);

const DOT_CATEGORY_LABELS: Record<string, string> = {
  drivers: "Drivers",
  vehicles: "Vehicles",
  dvirs: "DVIRs",
  roadside: "Roadside",
  accidents: "Accidents",
  "drug-alcohol": "Drug & Alcohol",
};

function dotActivityAt(
  payload: Record<string, unknown>,
  createdAt: Date,
  updatedAt?: Date,
): Date {
  for (const key of ["updatedAt", "eventDate", "inspectionDate"] as const) {
    const raw = payload[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) return updatedAt;
  return createdAt;
}

function parseDueDate(payload: Record<string, unknown>): Date | null {
  for (const key of ["dueDate", "expiryDate", "expirationDate", "medicalCertExpiry"] as const) {
    const raw = payload[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Bridge parity: intake.incidentDate | incidentDate | injuryDate | createdAt. */
function wcInjuryAt(payload: Record<string, unknown>, createdAt: Date): Date {
  const intake = asRecord(payload.intake);
  for (const raw of [
    intake.incidentDate,
    intake.injuryDate,
    payload.incidentDate,
    payload.injuryDate,
    payload.dateOccurred,
  ]) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return createdAt;
}

function wcWorkflowStage(payload: Record<string, unknown>, status: string): string {
  const stage = String(payload.workflowStage ?? status ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  return stage || "unknown";
}

function wcIsOpen(stage: string): boolean {
  return stage !== "closed";
}

function wcDaysOpen(payload: Record<string, unknown>, injuryAt: Date, now: Date): number {
  if (typeof payload.daysOpen === "number" && Number.isFinite(payload.daysOpen)) {
    return Math.max(0, Math.floor(payload.daysOpen));
  }
  const ms = now.getTime() - injuryAt.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function wcNestedString(
  payload: Record<string, unknown>,
  paths: Array<[string] | [string, string]>,
  fallback = "Unknown",
): string {
  for (const path of paths) {
    if (path.length === 1) {
      const v = String(payload[path[0]] ?? "").trim();
      if (v) return v;
    } else {
      const nest = asRecord(payload[path[0]]);
      const v = String(nest[path[1]] ?? "").trim();
      if (v) return v;
    }
  }
  return fallback;
}

function wcBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeCategory(payload: Record<string, unknown>): string {
  const raw = String(payload.category ?? payload.incidentCategory ?? "uncategorized")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return raw || "uncategorized";
}

function normalizeSeverity(payload: Record<string, unknown>): string {
  const raw = String(payload.severity ?? "unspecified").trim().toLowerCase();
  return raw || "unspecified";
}

function matchesStatus(rowStatus: string, statusFilter: string | null): boolean {
  if (!statusFilter) return true;
  return rowStatus.toLowerCase() === statusFilter.toLowerCase();
}

function matchesSeverity(payload: Record<string, unknown>, severityFilter: string | null): boolean {
  if (!severityFilter) return true;
  return normalizeSeverity(payload) === severityFilter.toLowerCase();
}

function payloadFacilityLabel(payload: Record<string, unknown>): string {
  return wcNestedString(
    payload,
    [["facility"], ["site"], ["location"], ["company"], ["employee", "facility"], ["employee", "site"]],
    "",
  );
}

function payloadDepartmentLabel(payload: Record<string, unknown>): string {
  return wcNestedString(
    payload,
    [["department"], ["departmentId"], ["dept"], ["employee", "department"], ["employee", "departmentId"]],
    "",
  );
}

function matchesOrgGrain(
  payload: Record<string, unknown>,
  facilityId: string | null | undefined,
  departmentId: string | null | undefined,
): boolean {
  if (facilityId) {
    const label = payloadFacilityLabel(payload);
    if (!label || label.toLowerCase() !== facilityId.toLowerCase()) return false;
  }
  if (departmentId) {
    const label = payloadDepartmentLabel(payload);
    if (!label || label.toLowerCase() !== departmentId.toLowerCase()) return false;
  }
  return true;
}

function orgFilterWarning(
  facilityId: string | null | undefined,
  departmentId: string | null | undefined,
): string | null {
  const bits: string[] = [];
  if (facilityId) bits.push(`facility=${facilityId}`);
  if (departmentId) bits.push(`department=${departmentId}`);
  if (bits.length === 0) return null;
  return `Org filters applied: ${bits.join(", ")} (matched against payload facility/site and department labels).`;
}

function toSeries(map: Map<string, number>): AnalyticsSeriesPoint[] {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, value]) => ({ bucket, value }));
}

function toNamed(
  map: Map<string, number>,
  labels: Record<string, string> = {},
): AnalyticsNamedCount[] {
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: labels[key] ?? CATEGORY_LABELS[key] ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

const MODULE_LABELS: Record<string, string> = {
  incidents: "Incidents",
  inspections: "Inspections",
  observations: "Observations",
  training: "Training",
  forms: "Forms",
  jsas: "JSAs",
  loto: "Lockout/Tagout",
  personnel: "Personnel",
  equipment: "Equipment",
  sites: "Sites",
  "workers-comp": "Workers' Comp",
  dot: "DOT Compliance",
};

@Injectable()
export class IndustrialAnalyticsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private assertAccess(principal: ForgePrincipal): void {
    if (principal.isPlatformAdmin) return;
    if (!principal.permissions.has("industrial.access")) {
      throw new ForgeError("FORBIDDEN", "industrial.access permission is required");
    }
    if (!principal.activeProducts.has(INDUSTRIAL_PRODUCT_CODE)) {
      throw new ForgeError("FORBIDDEN", "Tenant is not entitled to Forge Industrial Safety");
    }
  }

  notImplemented(
    principal: ForgePrincipal,
    domain: IndustrialAnalyticsDomain,
    query: Record<string, string | undefined>,
  ): AnalyticsDomainStub {
    this.assertAccess(principal);
    return {
      domain,
      status: "NOT_IMPLEMENTED",
      message: `Industrial analytics domain "${domain}" is reserved; Phase B implementation pending.`,
      filter: defaultFilter(query),
    };
  }

  async filterOptions(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsFilterOptions> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({ payload: industrialOpsRecords.payload })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );

      const facilityCounts = new Map<string, number>();
      const departmentCounts = new Map<string, number>();
      for (const row of rows) {
        const payload = asPayload(row.payload);
        const facility = payloadFacilityLabel(payload);
        const department = payloadDepartmentLabel(payload);
        if (facility && facility !== "Unknown") {
          facilityCounts.set(facility, (facilityCounts.get(facility) ?? 0) + 1);
        }
        if (department && department !== "Unknown") {
          departmentCounts.set(department, (departmentCounts.get(department) ?? 0) + 1);
        }
      }

      const toOptions = (map: Map<string, number>) =>
        [...map.entries()]
          .map(([value, count]) => ({ value, label: value, count }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .slice(0, 100);

      const warnings: string[] = [];
      if (rows.length === 0) {
        warnings.push(
          "No industrial_ops_records for this tenant — facility/department dropdowns are empty until ops data is loaded.",
        );
      } else if (facilityCounts.size === 0 && departmentCounts.size === 0) {
        warnings.push(
          "Ops records exist but no facility/site or department labels were found on payloads.",
        );
      }

      return {
        domain: "filter-options",
        generatedAt: new Date().toISOString(),
        filter: { from: filter.from, to: filter.to },
        facilities: toOptions(facilityCounts),
        departments: toOptions(departmentCounts),
        warnings,
      };
    });
  }

  async overview(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsOverview> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);
    const from = parseDay(filter.from, new Date());
    const to = endOfDayUtc(parseDay(filter.to, new Date()));

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: industrialOpsRecords.id,
          module: industrialOpsRecords.module,
          status: industrialOpsRecords.status,
          title: industrialOpsRecords.title,
          payload: industrialOpsRecords.payload,
          createdAt: industrialOpsRecords.createdAt,
          updatedAt: industrialOpsRecords.updatedAt,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            isNull(industrialOpsRecords.archivedAt),
            gte(industrialOpsRecords.createdAt, from),
            lte(industrialOpsRecords.createdAt, to),
          ),
        );

      const statusFilter = filter.status?.trim() || null;
      const severityFilter = filter.severity?.trim().toLowerCase() || null;

      const byModule = new Map<string, { inRange: number; open: number }>();
      const incidentTrendMap = new Map<string, number>();
      const inspectionTrendMap = new Map<string, number>();
      const observationsTrendMap = new Map<string, number>();
      const categoryCounts = new Map<string, number>();
      const siteCounts = new Map<string, number>();

      let openIncidents = 0;
      let inspectionScoreSum = 0;
      let inspectionScoreN = 0;
      let filteredRowCount = 0;

      for (const row of rows) {
        if (!matchesStatus(row.status, statusFilter)) continue;
        const payload = asPayload(row.payload);
        if (!matchesOrgGrain(payload, filter.facilityId, filter.departmentId)) continue;
        const mod = row.module;
        // Severity is incident-centric (Bridge chart dim → AWS filter).
        if (mod === "incidents" && !matchesSeverity(payload, severityFilter)) continue;
        filteredRowCount += 1;

        const slot = byModule.get(mod) ?? { inRange: 0, open: 0 };
        slot.inRange += 1;
        if (OPENISH.has(row.status)) slot.open += 1;
        byModule.set(mod, slot);

        const day = isoDate(row.createdAt);

        if (mod === "incidents") {
          if (OPENISH.has(row.status)) openIncidents += 1;
          incidentTrendMap.set(day, (incidentTrendMap.get(day) ?? 0) + 1);
          const cat = normalizeCategory(payload);
          categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
        }
        if (mod === "inspections") {
          inspectionTrendMap.set(day, (inspectionTrendMap.get(day) ?? 0) + 1);
          const score = Number(payload.score);
          if (Number.isFinite(score) && score > 0) {
            inspectionScoreSum += score;
            inspectionScoreN += 1;
          }
          const site = String(payload.site ?? payload.company ?? payload.facility ?? "Unknown");
          siteCounts.set(site, (siteCounts.get(site) ?? 0) + 1);
        }
        if (mod === "observations") {
          observationsTrendMap.set(day, (observationsTrendMap.get(day) ?? 0) + 1);
        }
      }

      // Also count currently open incidents outside the date window for KPI parity with Bridge.
      const openRows = await tx
        .select({
          status: industrialOpsRecords.status,
          payload: industrialOpsRecords.payload,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, "incidents"),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );
      const openIncidentsCurrent = openRows.filter((r) => {
        if (!OPENISH.has(r.status)) return false;
        if (!matchesStatus(r.status, statusFilter)) return false;
        const payload = asPayload(r.payload);
        if (!matchesSeverity(payload, severityFilter)) return false;
        if (!matchesOrgGrain(payload, filter.facilityId, filter.departmentId)) return false;
        return true;
      }).length;

      const incidentsInRange = byModule.get("incidents")?.inRange ?? 0;
      const inspectionsInRange = byModule.get("inspections")?.inRange ?? 0;
      const observationsInRange = byModule.get("observations")?.inRange ?? 0;
      const trainingInRange = byModule.get("training")?.inRange ?? 0;
      const avgInspectionScore =
        inspectionScoreN > 0 ? Math.round((inspectionScoreSum / inspectionScoreN) * 10) / 10 : null;

      // Transparent formula (Phase A): start at 100; deduct for open incidents / low inspection score.
      let safetyScore: number | null = 100;
      safetyScore -= Math.min(40, openIncidentsCurrent * 4);
      if (avgInspectionScore !== null) {
        safetyScore -= Math.max(0, Math.round((100 - avgInspectionScore) * 0.25));
      }
      safetyScore = Math.max(0, Math.min(100, safetyScore));
      if (filteredRowCount === 0) safetyScore = null;

      const moduleActivity: AnalyticsModuleActivity[] = [...byModule.entries()]
        .map(([module, stats]) => ({
          module,
          label: MODULE_LABELS[module] ?? module,
          inRange: stats.inRange,
          open: stats.open,
        }))
        .sort((a, b) => b.inRange - a.inRange);

      const warnings: string[] = [];
      if (rows.length === 0) {
        warnings.push(
          "No industrial_ops_records in range for this tenant — KPIs are empty (not placeholder zeros).",
        );
      } else if (filteredRowCount === 0) {
        warnings.push("No records match the selected severity/status filters in this date range.");
      }
      if (statusFilter || severityFilter) {
        const bits = [
          statusFilter ? `status=${statusFilter}` : null,
          severityFilter ? `severity=${severityFilter}` : null,
        ].filter(Boolean);
        warnings.push(`Filters applied: ${bits.join(", ")}. Severity applies to incidents only.`);
      }
      const orgWarn = orgFilterWarning(filter.facilityId, filter.departmentId);
      if (orgWarn && !warnings.includes(orgWarn)) warnings.push(orgWarn);
      warnings.push(
        "Firebase Bridge Safety Intelligence Center remains Analytics SoT until Phase D acceptance.",
      );

      return {
        domain: "overview",
        generatedAt: new Date().toISOString(),
        filter,
        safetyScore,
        safetyGrade: safetyGrade(safetyScore),
        kpis: [
          {
            id: "open-incidents",
            label: "Open Incidents",
            value: openIncidentsCurrent,
            drillDomain: "incidents",
            accent: openIncidentsCurrent > 0 ? "warning" : "success",
          },
          {
            id: "incidents-in-range",
            label: "Incidents in range",
            value: incidentsInRange,
            drillDomain: "incidents",
          },
          {
            id: "inspections-in-range",
            label: "Inspections",
            value: inspectionsInRange,
            drillDomain: "inspections",
          },
          {
            id: "inspection-score",
            label: "Avg. Inspection Score",
            value: avgInspectionScore,
            ...(avgInspectionScore === null ? {} : { unit: "%" as const }),
            drillDomain: "inspections",
          },
          {
            id: "observations-in-range",
            label: "Observations",
            value: observationsInRange,
          },
          {
            id: "training-in-range",
            label: "Training records",
            value: trainingInRange,
            drillDomain: "personnel",
          },
          {
            id: "open-incidents-in-range",
            label: "Open-ish incidents (in range)",
            value: openIncidents,
            drillDomain: "incidents",
          },
        ] as AnalyticsOverview["kpis"],
        moduleActivity,
        incidentTrend: toSeries(incidentTrendMap),
        inspectionTrend: toSeries(inspectionTrendMap),
        observationsTrend: toSeries(observationsTrendMap),
        incidentsByCategory: toNamed(categoryCounts, CATEGORY_LABELS),
        inspectionsBySite: toNamed(siteCounts),
        warnings,
        links: [],
      };
    });
  }

  async incidents(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsIncidents> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);
    const from = parseDay(filter.from, new Date());
    const to = endOfDayUtc(parseDay(filter.to, new Date()));
    const severityFilter = filter.severity?.trim().toLowerCase() || null;
    const statusFilter = filter.status?.trim().toLowerCase() || null;

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: industrialOpsRecords.id,
          status: industrialOpsRecords.status,
          title: industrialOpsRecords.title,
          payload: industrialOpsRecords.payload,
          createdAt: industrialOpsRecords.createdAt,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, "incidents"),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );

      const openIncidentsCurrent = rows.filter((r) => {
        if (!OPENISH.has(r.status)) return false;
        return matchesOrgGrain(asPayload(r.payload), filter.facilityId, filter.departmentId);
      }).length;

      type Enriched = {
        id: string;
        status: string;
        title: string;
        category: string;
        severity: string;
        bodyPart: string;
        eventAt: Date;
      };

      const enriched: Enriched[] = [];
      for (const row of rows) {
        const payload = asPayload(row.payload);
        if (!matchesOrgGrain(payload, filter.facilityId, filter.departmentId)) continue;
        const bodyRaw = payload.bodyPart ?? payload.body_part ?? "";
        enriched.push({
          id: row.id,
          status: row.status,
          title: row.title,
          category: normalizeCategory(payload),
          severity: normalizeSeverity(payload),
          bodyPart: typeof bodyRaw === "string" && bodyRaw.trim() ? bodyRaw.trim() : "Unspecified",
          eventAt: incidentEventAt(payload, row.createdAt),
        });
      }

      const inRange = enriched.filter((row) => {
        if (row.eventAt < from || row.eventAt > to) return false;
        if (severityFilter && row.severity !== severityFilter) return false;
        if (statusFilter && row.status.toLowerCase() !== statusFilter) return false;
        return true;
      });

      const categoryCounts = new Map<string, number>();
      const severityCounts = new Map<string, number>();
      const bodyPartCounts = new Map<string, number>();
      const trendMap = new Map<string, number>();
      let injuries = 0;
      let nearMisses = 0;
      let openInRange = 0;

      for (const row of inRange) {
        categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
        severityCounts.set(row.severity, (severityCounts.get(row.severity) ?? 0) + 1);
        const day = isoDate(row.eventAt);
        trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
        if (OPENISH.has(row.status)) openInRange += 1;
        if (row.category === "injuries" || row.category === "injury") {
          injuries += 1;
          bodyPartCounts.set(row.bodyPart, (bodyPartCounts.get(row.bodyPart) ?? 0) + 1);
        }
        if (row.category === "near-misses" || row.category === "near-miss") nearMisses += 1;
      }

      const sortedRecent = [...inRange].sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime());
      const recent: AnalyticsLink[] = sortedRecent.slice(0, 25).map((row) => ({
        rel: "incident",
        module: "incidents",
        id: row.id,
        href: "/modules/incidents",
        label: row.title || row.id,
      }));

      // Bridge-style half-window delta on in-range volume.
      const mid = from.getTime() + (to.getTime() - from.getTime()) / 2;
      const recentHalf = inRange.filter((r) => r.eventAt.getTime() >= mid).length;
      const priorHalf = inRange.length - recentHalf;
      const volumeDelta =
        priorHalf > 0 ? (recentHalf - priorHalf) / priorHalf : recentHalf > 0 ? 1 : null;

      const warnings: string[] = [];
      if (rows.length === 0) {
        warnings.push("No incidents found for this tenant in industrial_ops_records.");
      } else if (inRange.length === 0) {
        warnings.push("No incidents in the selected date range (using dateOccurred|incidentDate|createdAt).");
      }
      if (statusFilter || severityFilter) {
        const bits = [
          statusFilter ? `status=${statusFilter}` : null,
          severityFilter ? `severity=${severityFilter}` : null,
        ].filter(Boolean);
        warnings.push(`Filters applied: ${bits.join(", ")}.`);
      }
      const orgWarn = orgFilterWarning(filter.facilityId, filter.departmentId);
      if (orgWarn && !warnings.includes(orgWarn)) warnings.push(orgWarn);
      warnings.push(
        "Firebase Bridge Safety Intelligence Center remains Analytics SoT until Phase D acceptance.",
      );

      return {
        domain: "incidents",
        generatedAt: new Date().toISOString(),
        filter,
        kpis: [
          {
            id: "open-incidents",
            label: "Open Incidents",
            value: openIncidentsCurrent,
            accent: openIncidentsCurrent > 0 ? "warning" : "success",
            drillDomain: "incidents",
            drillFilters: { status: "open" },
          },
          {
            id: "incidents-in-range",
            label: "Incidents in Range",
            value: inRange.length,
            ...(volumeDelta === null ? {} : { delta: Math.round(volumeDelta * 1000) / 1000 }),
            drillDomain: "incidents",
          },
          {
            id: "injuries-logged",
            label: "Injuries Logged",
            value: injuries,
            accent: injuries > 0 ? "danger" : "default",
            drillDomain: "incidents",
          },
          {
            id: "near-misses",
            label: "Near Misses",
            value: nearMisses,
            drillDomain: "incidents",
          },
          {
            id: "open-in-range",
            label: "Open-ish (in range)",
            value: openInRange,
            accent: openInRange > 0 ? "warning" : "success",
            drillDomain: "incidents",
          },
        ],
        incidentTrend: toSeries(trendMap),
        byCategory: toNamed(categoryCounts, CATEGORY_LABELS),
        bySeverity: toNamed(severityCounts, SEVERITY_LABELS),
        injuriesByBodyPart: [...bodyPartCounts.entries()]
          .map(([bodyPart, count]) => ({ bodyPart, count }))
          .sort((a, b) => b.count - a.count || a.bodyPart.localeCompare(b.bodyPart)),
        recent,
        warnings,
      };
    });
  }

  async inspections(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsInspections> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);
    const from = parseDay(filter.from, new Date());
    const to = endOfDayUtc(parseDay(filter.to, new Date()));
    const statusFilter = filter.status?.trim().toLowerCase() || null;
    // Severity is incident-centric; ignored for inspections but kept in filter envelope for shared context.

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: industrialOpsRecords.id,
          status: industrialOpsRecords.status,
          title: industrialOpsRecords.title,
          payload: industrialOpsRecords.payload,
          createdAt: industrialOpsRecords.createdAt,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, "inspections"),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );

      type Enriched = {
        id: string;
        status: string;
        title: string;
        site: string;
        score: number | null;
        eventAt: Date;
      };

      const enriched: Enriched[] = [];
      for (const row of rows) {
        const payload = asPayload(row.payload);
        if (!matchesOrgGrain(payload, filter.facilityId, filter.departmentId)) continue;
        const scoreRaw = Number(payload.score);
        enriched.push({
          id: row.id,
          status: row.status,
          title: row.title,
          site: String(payload.site ?? payload.company ?? payload.facility ?? "Unknown"),
          score: Number.isFinite(scoreRaw) && scoreRaw > 0 ? scoreRaw : null,
          eventAt: inspectionEventAt(payload, row.createdAt),
        });
      }

      const inRange = enriched.filter((row) => {
        if (row.eventAt < from || row.eventAt > to) return false;
        if (statusFilter && row.status.toLowerCase() !== statusFilter) return false;
        return true;
      });

      const siteCounts = new Map<string, number>();
      const statusCounts = new Map<string, number>();
      const trendMap = new Map<string, number>();
      let scoreSum = 0;
      let scoreN = 0;
      let openInRange = 0;
      let scoredSubmitted = 0;

      for (const row of inRange) {
        siteCounts.set(row.site, (siteCounts.get(row.site) ?? 0) + 1);
        const statusKey = row.status.toLowerCase();
        statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1);
        trendMap.set(isoDate(row.eventAt), (trendMap.get(isoDate(row.eventAt)) ?? 0) + 1);
        if (OPENISH.has(row.status)) openInRange += 1;
        if (row.score !== null) {
          // Bridge: avg where status=submitted & score>0; also accept CLOSED-like submitted names.
          const submittedish =
            statusKey === "submitted" ||
            statusKey === "closed" ||
            statusKey === "complete" ||
            statusKey === "completed" ||
            statusKey === "active";
          if (submittedish || row.score > 0) {
            scoreSum += row.score;
            scoreN += 1;
            if (statusKey === "submitted") scoredSubmitted += 1;
          }
        }
      }

      const avgScore = scoreN > 0 ? Math.round((scoreSum / scoreN) * 10) / 10 : null;

      const mid = from.getTime() + (to.getTime() - from.getTime()) / 2;
      const recentHalf = inRange.filter((r) => r.eventAt.getTime() >= mid).length;
      const priorHalf = inRange.length - recentHalf;
      const volumeDelta =
        priorHalf > 0 ? (recentHalf - priorHalf) / priorHalf : recentHalf > 0 ? 1 : null;

      const sortedRecent = [...inRange].sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime());
      const recent: AnalyticsLink[] = sortedRecent.slice(0, 25).map((row) => ({
        rel: "inspection",
        module: "inspections",
        id: row.id,
        href: "/modules/inspections",
        label: row.title || row.id,
      }));

      const warnings: string[] = [];
      if (rows.length === 0) {
        warnings.push("No inspections found for this tenant in industrial_ops_records.");
      } else if (inRange.length === 0) {
        warnings.push("No inspections in the selected date range (using inspectionDate|createdAt).");
      }
      if (filter.severity) {
        warnings.push("Severity filter is incident-centric and does not constrain inspections.");
      }
      if (statusFilter) {
        warnings.push(`Filters applied: status=${statusFilter}.`);
      }
      const orgWarn = orgFilterWarning(filter.facilityId, filter.departmentId);
      if (orgWarn && !warnings.includes(orgWarn)) warnings.push(orgWarn);
      if (scoredSubmitted === 0 && scoreN > 0) {
        warnings.push(
          "Inspection score averaged from score>0 rows (submitted status uncommon in ops payloads).",
        );
      }
      warnings.push(
        "Firebase Bridge Safety Intelligence Center remains Analytics SoT until Phase D acceptance.",
      );

      return {
        domain: "inspections",
        generatedAt: new Date().toISOString(),
        filter,
        kpis: [
          {
            id: "inspections-in-range",
            label: "Inspections",
            value: inRange.length,
            ...(volumeDelta === null ? {} : { delta: Math.round(volumeDelta * 1000) / 1000 }),
            drillDomain: "inspections",
          },
          {
            id: "inspection-score",
            label: "Inspection Score",
            value: avgScore,
            ...(avgScore === null ? {} : { unit: "%" as const }),
            drillDomain: "inspections",
          },
          {
            id: "open-in-range",
            label: "Open-ish (in range)",
            value: openInRange,
            accent: openInRange > 0 ? "warning" : "success",
            drillDomain: "inspections",
          },
          {
            id: "sites-touched",
            label: "Sites with inspections",
            value: siteCounts.size,
            drillDomain: "inspections",
          },
        ],
        inspectionTrend: toSeries(trendMap),
        bySite: toNamed(siteCounts).slice(0, 8),
        byStatus: toNamed(statusCounts),
        recent,
        warnings,
      };
    });
  }

  async personnel(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsPersonnel> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);
    const from = parseDay(filter.from, new Date());
    const to = endOfDayUtc(parseDay(filter.to, new Date()));
    const statusFilter = filter.status?.trim().toLowerCase() || null;
    const now = new Date();

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: industrialOpsRecords.id,
          module: industrialOpsRecords.module,
          status: industrialOpsRecords.status,
          title: industrialOpsRecords.title,
          payload: industrialOpsRecords.payload,
          createdAt: industrialOpsRecords.createdAt,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );

      const trainingRows = rows.filter((r) => r.module === "training");
      const personnelRows = rows.filter(
        (r) =>
          r.module === "personnel" &&
          matchesOrgGrain(asPayload(r.payload), filter.facilityId, filter.departmentId),
      );

      type Enriched = {
        id: string;
        module: string;
        status: string;
        title: string;
        eventAt: Date;
        dueAt: Date | null;
        completed: boolean;
      };

      const enrichedTraining: Enriched[] = [];
      for (const row of trainingRows) {
        const payload = asPayload(row.payload);
        if (!matchesOrgGrain(payload, filter.facilityId, filter.departmentId)) continue;
        const statusKey = row.status.toLowerCase();
        const completed =
          statusKey === "completed" ||
          statusKey === "complete" ||
          statusKey === "closed" ||
          Boolean(payload.completedAt);
        let dueAt: Date | null = null;
        if (typeof payload.dueDate === "string" && payload.dueDate.trim()) {
          const d = new Date(payload.dueDate);
          if (!Number.isNaN(d.getTime())) dueAt = d;
        }
        enrichedTraining.push({
          id: row.id,
          module: "training",
          status: row.status,
          title: row.title,
          eventAt: trainingEventAt(payload, row.createdAt),
          dueAt,
          completed,
        });
      }

      const trainingInRange = enrichedTraining.filter((row) => {
        if (row.eventAt < from || row.eventAt > to) return false;
        if (statusFilter && row.status.toLowerCase() !== statusFilter) return false;
        return true;
      });

      const completionsInRange = trainingInRange.filter((r) => r.completed).length;
      const activeBase = enrichedTraining.filter(
        (r) => !r.completed || OPENISH.has(r.status),
      ).length;
      const completionRate =
        enrichedTraining.length > 0
          ? Math.round((enrichedTraining.filter((r) => r.completed).length / enrichedTraining.length) * 1000) /
            10
          : null;
      const overdue = enrichedTraining.filter(
        (r) => !r.completed && r.dueAt !== null && r.dueAt < now,
      ).length;

      const statusCounts = new Map<string, number>();
      const trendMap = new Map<string, number>();
      for (const row of trainingInRange) {
        const sk = row.status.toLowerCase();
        statusCounts.set(sk, (statusCounts.get(sk) ?? 0) + 1);
        trendMap.set(isoDate(row.eventAt), (trendMap.get(isoDate(row.eventAt)) ?? 0) + 1);
      }

      const mid = from.getTime() + (to.getTime() - from.getTime()) / 2;
      const recentHalf = trainingInRange.filter((r) => r.eventAt.getTime() >= mid).length;
      const priorHalf = trainingInRange.length - recentHalf;
      const volumeDelta =
        priorHalf > 0 ? (recentHalf - priorHalf) / priorHalf : recentHalf > 0 ? 1 : null;

      const sortedRecent = [...trainingInRange].sort(
        (a, b) => b.eventAt.getTime() - a.eventAt.getTime(),
      );
      const recent: AnalyticsLink[] = sortedRecent.slice(0, 25).map((row) => ({
        rel: "training",
        module: "personnel",
        id: row.id,
        href: "/modules/personnel",
        label: row.title || row.id,
      }));

      const warnings: string[] = [];
      if (trainingRows.length === 0 && personnelRows.length === 0) {
        warnings.push(
          "No training or personnel rows in industrial_ops_records for this tenant.",
        );
      } else if (trainingInRange.length === 0) {
        warnings.push(
          "No training records in the selected date range (using completedAt|dueDate|enrolledAt|createdAt).",
        );
      }
      if (filter.severity) {
        warnings.push("Severity filter is incident-centric and does not constrain personnel/training.");
      }
      if (statusFilter) {
        warnings.push(`Filters applied: status=${statusFilter}.`);
      }
      const orgWarn = orgFilterWarning(filter.facilityId, filter.departmentId);
      if (orgWarn && !warnings.includes(orgWarn)) warnings.push(orgWarn);
      warnings.push(
        "Org-level training KPIs only; Bridge person-scoped PER-* profile analytics not yet on this route.",
      );
      warnings.push(
        "Firebase Bridge Safety Intelligence Center remains Analytics SoT until Phase D acceptance.",
      );

      return {
        domain: "personnel",
        generatedAt: new Date().toISOString(),
        filter,
        kpis: [
          {
            id: "training-in-range",
            label: "Training records (in range)",
            value: trainingInRange.length,
            ...(volumeDelta === null ? {} : { delta: Math.round(volumeDelta * 1000) / 1000 }),
            drillDomain: "personnel",
          },
          {
            id: "training-completions",
            label: "Completions (in range)",
            value: completionsInRange,
            accent: "success",
            drillDomain: "personnel",
          },
          {
            id: "training-completion-rate",
            label: "Completion rate (all-time base)",
            value: completionRate,
            ...(completionRate === null ? {} : { unit: "%" as const }),
            drillDomain: "personnel",
          },
          {
            id: "training-overdue",
            label: "Overdue training",
            value: overdue,
            accent: overdue > 0 ? "warning" : "success",
            drillDomain: "personnel",
          },
          {
            id: "personnel-roster",
            label: "Personnel records",
            value: personnelRows.length,
            drillDomain: "personnel",
          },
          {
            id: "training-active-base",
            label: "Active-ish training (all-time)",
            value: activeBase,
            drillDomain: "personnel",
          },
        ],
        trainingTrend: toSeries(trendMap),
        byStatus: toNamed(statusCounts),
        recent,
        warnings,
      };
    });
  }

  async loto(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsLoto> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);
    const from = parseDay(filter.from, new Date());
    const to = endOfDayUtc(parseDay(filter.to, new Date()));
    const statusFilter = filter.status?.trim().toLowerCase() || null;
    const now = new Date();
    const in30 = new Date(now);
    in30.setUTCDate(in30.getUTCDate() + 30);

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: industrialOpsRecords.id,
          status: industrialOpsRecords.status,
          title: industrialOpsRecords.title,
          payload: industrialOpsRecords.payload,
          createdAt: industrialOpsRecords.createdAt,
          updatedAt: industrialOpsRecords.updatedAt,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, "loto"),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );

      type Enriched = {
        id: string;
        status: string;
        title: string;
        site: string;
        category: string;
        eventAt: Date;
        dueAt: Date | null;
      };

      const enriched: Enriched[] = [];
      for (const row of rows) {
        const payload = asPayload(row.payload);
        if (!matchesOrgGrain(payload, filter.facilityId, filter.departmentId)) continue;
        let dueAt: Date | null = null;
        if (typeof payload.dueDate === "string" && payload.dueDate.trim()) {
          const d = new Date(payload.dueDate);
          if (!Number.isNaN(d.getTime())) dueAt = d;
        }
        enriched.push({
          id: row.id,
          status: row.status,
          title: row.title,
          site: String(payload.site ?? payload.facility ?? payload.company ?? "Unknown"),
          category: String(payload.category ?? "uncategorized").trim() || "uncategorized",
          eventAt: lotoEventAt(payload, row.createdAt, row.updatedAt),
          dueAt,
        });
      }

      const openCurrent = enriched.filter((r) => LOTO_ATTENTION.has(r.status)).length;
      const inRange = enriched.filter((row) => {
        if (row.eventAt < from || row.eventAt > to) return false;
        if (statusFilter && row.status.toLowerCase() !== statusFilter) return false;
        return true;
      });

      const statusCounts = new Map<string, number>();
      const siteCounts = new Map<string, number>();
      const categoryCounts = new Map<string, number>();
      const trendMap = new Map<string, number>();
      let openInRange = 0;
      for (const row of inRange) {
        statusCounts.set(row.status.toLowerCase(), (statusCounts.get(row.status.toLowerCase()) ?? 0) + 1);
        siteCounts.set(row.site, (siteCounts.get(row.site) ?? 0) + 1);
        categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
        trendMap.set(isoDate(row.eventAt), (trendMap.get(isoDate(row.eventAt)) ?? 0) + 1);
        if (LOTO_ATTENTION.has(row.status)) openInRange += 1;
      }

      const expiring30 = enriched.filter(
        (r) =>
          r.dueAt !== null &&
          r.dueAt >= now &&
          r.dueAt <= in30 &&
          LOTO_ATTENTION.has(r.status),
      ).length;

      const mid = from.getTime() + (to.getTime() - from.getTime()) / 2;
      const recentHalf = inRange.filter((r) => r.eventAt.getTime() >= mid).length;
      const priorHalf = inRange.length - recentHalf;
      const volumeDelta =
        priorHalf > 0 ? (recentHalf - priorHalf) / priorHalf : recentHalf > 0 ? 1 : null;

      const sortedRecent = [...inRange].sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime());
      const recent: AnalyticsLink[] = sortedRecent.slice(0, 25).map((row) => ({
        rel: "loto",
        module: "loto",
        id: row.id,
        href: "/modules/loto",
        label: row.title || row.id,
      }));

      const warnings: string[] = [];
      if (rows.length === 0) {
        warnings.push("No LOTO records found for this tenant in industrial_ops_records.");
      } else if (inRange.length === 0) {
        warnings.push(
          "No LOTO activity in the selected date range (using eventDate|dueDate|updatedAt|createdAt).",
        );
      }
      if (filter.severity) {
        warnings.push("Severity filter is incident-centric and does not constrain LOTO.");
      }
      if (statusFilter) {
        warnings.push(`Filters applied: status=${statusFilter}.`);
      }
      const orgWarn = orgFilterWarning(filter.facilityId, filter.departmentId);
      if (orgWarn && !warnings.includes(orgWarn)) warnings.push(orgWarn);
      warnings.push(
        "Dedicated LOTO domain; Bridge SIC surfaces LOTO inside Enterprise Programs rollup.",
      );
      warnings.push(
        "Firebase Bridge Safety Intelligence Center remains Analytics SoT until Phase D acceptance.",
      );

      return {
        domain: "loto",
        generatedAt: new Date().toISOString(),
        filter,
        kpis: [
          {
            id: "loto-open",
            label: "Open / attention LOTO",
            value: openCurrent,
            accent: openCurrent > 0 ? "warning" : "success",
            drillDomain: "loto",
          },
          {
            id: "loto-activity-in-range",
            label: "LOTO activity (in range)",
            value: inRange.length,
            ...(volumeDelta === null ? {} : { delta: Math.round(volumeDelta * 1000) / 1000 }),
            drillDomain: "loto",
          },
          {
            id: "loto-open-in-range",
            label: "Open-ish (in range)",
            value: openInRange,
            accent: openInRange > 0 ? "warning" : "success",
            drillDomain: "loto",
          },
          {
            id: "loto-expiring-30",
            label: "Expiring within 30 days",
            value: expiring30,
            accent: expiring30 > 0 ? "warning" : "default",
            drillDomain: "loto",
          },
        ],
        activityTrend: toSeries(trendMap),
        byStatus: toNamed(statusCounts),
        bySite: toNamed(siteCounts).slice(0, 8),
        byCategory: toNamed(categoryCounts),
        recent,
        warnings,
      };
    });
  }

  async dot(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsDot> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);
    const from = parseDay(filter.from, new Date());
    const to = endOfDayUtc(parseDay(filter.to, new Date()));
    const statusFilter = filter.status?.trim().toLowerCase() || null;
    const now = new Date();
    const in30 = new Date(now);
    in30.setUTCDate(in30.getUTCDate() + 30);

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: industrialOpsRecords.id,
          status: industrialOpsRecords.status,
          title: industrialOpsRecords.title,
          payload: industrialOpsRecords.payload,
          createdAt: industrialOpsRecords.createdAt,
          updatedAt: industrialOpsRecords.updatedAt,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, "dot"),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );

      type Enriched = {
        id: string;
        status: string;
        title: string;
        category: string;
        activityAt: Date;
        dueAt: Date | null;
      };

      const enriched: Enriched[] = [];
      for (const row of rows) {
        const payload = asPayload(row.payload);
        if (!matchesOrgGrain(payload, filter.facilityId, filter.departmentId)) continue;
        enriched.push({
          id: row.id,
          status: row.status,
          title: row.title,
          category: String(payload.category ?? "uncategorized")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-") || "uncategorized",
          activityAt: dotActivityAt(payload, row.createdAt, row.updatedAt),
          dueAt: parseDueDate(payload),
        });
      }

      const afterStatus = statusFilter
        ? enriched.filter((r) => r.status.toLowerCase() === statusFilter)
        : enriched;

      // Score / fleet KPIs — all-time (Bridge parity)
      const tracked = afterStatus.filter((r) => DOT_TRACKED.has(r.category));
      const compliantTracked = tracked.filter((r) => DOT_COMPLIANT.has(r.status)).length;
      const score =
        tracked.length === 0 ? null : Math.round((compliantTracked / tracked.length) * 100);
      const openItems = afterStatus.filter((r) => DOT_OPEN.has(r.status)).length;
      const expired = afterStatus.filter(
        (r) =>
          r.status.toLowerCase() === "expired" ||
          (r.dueAt !== null && r.dueAt < now && !DOT_COMPLIANT.has(r.status)),
      ).length;
      const expiring30 = afterStatus.filter(
        (r) => r.dueAt !== null && r.dueAt >= now && r.dueAt <= in30,
      ).length;
      const drivers = afterStatus.filter((r) => r.category === "drivers").length;
      const vehicles = afterStatus.filter((r) => r.category === "vehicles").length;

      const categoryCounts = new Map<string, number>();
      const statusCountsAll = new Map<string, number>();
      for (const row of afterStatus) {
        categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
        statusCountsAll.set(
          row.status.toLowerCase(),
          (statusCountsAll.get(row.status.toLowerCase()) ?? 0) + 1,
        );
      }

      const compliantCount = afterStatus.filter((r) => DOT_COMPLIANT.has(r.status)).length;
      const openCount = afterStatus.filter((r) => DOT_OPEN.has(r.status)).length;
      const residual = Math.max(0, afterStatus.length - compliantCount - openCount);
      const fleetBreakdown: AnalyticsNamedCount[] = [
        { key: "compliant", label: "Compliant / closed", count: compliantCount },
        { key: "open", label: "Open / attention", count: openCount },
        { key: "other", label: "Other", count: residual },
      ].filter((r) => r.count > 0);

      const inRange = afterStatus.filter((r) => r.activityAt >= from && r.activityAt <= to);
      const trendMap = new Map<string, number>();
      for (const row of inRange) {
        trendMap.set(isoDate(row.activityAt), (trendMap.get(isoDate(row.activityAt)) ?? 0) + 1);
      }

      const sortedRecent = [...inRange].sort(
        (a, b) => b.activityAt.getTime() - a.activityAt.getTime(),
      );
      const recent: AnalyticsLink[] = sortedRecent.slice(0, 25).map((row) => ({
        rel: "dot",
        module: "dot",
        id: row.id,
        href: "/modules/dot-compliance",
        label: row.title || row.id,
      }));

      const warnings: string[] = [];
      if (rows.length === 0) {
        warnings.push(
          "No DOT rows in industrial_ops_records (module=dot). Ops create/list path may not expose DOT yet — empty KPIs expected until migration.",
        );
      }
      if (filter.severity) {
        warnings.push("Severity filter is incident-centric and does not constrain DOT.");
      }
      if (statusFilter) {
        warnings.push(`Filters applied: status=${statusFilter}.`);
      }
      const orgWarn = orgFilterWarning(filter.facilityId, filter.departmentId);
      if (orgWarn && !warnings.includes(orgWarn)) warnings.push(orgWarn);
      warnings.push(
        "DOT compliance score uses all records (not date-scoped), matching Bridge computeDotComplianceMetrics.",
      );
      warnings.push(
        "Firebase Bridge Safety Intelligence Center remains Analytics SoT until Phase D acceptance.",
      );

      return {
        domain: "dot",
        generatedAt: new Date().toISOString(),
        filter,
        kpis: [
          {
            id: "dot-score",
            label: "DOT Score",
            value: score,
            ...(score === null ? {} : { unit: "%" as const }),
            accent: score !== null && score < 80 ? "warning" : "success",
            drillDomain: "dot",
          },
          {
            id: "dot-total",
            label: "Total records",
            value: afterStatus.length,
            drillDomain: "dot",
          },
          {
            id: "dot-drivers",
            label: "Drivers",
            value: drivers,
            drillDomain: "dot",
          },
          {
            id: "dot-vehicles",
            label: "Vehicles",
            value: vehicles,
            drillDomain: "dot",
          },
          {
            id: "dot-open",
            label: "Open items",
            value: openItems,
            accent: openItems > 0 ? "warning" : "success",
            drillDomain: "dot",
          },
          {
            id: "dot-expired",
            label: "Expired",
            value: expired,
            accent: expired > 0 ? "danger" : "success",
            drillDomain: "dot",
          },
          {
            id: "dot-expiring-30",
            label: "Expiring within 30 days",
            value: expiring30,
            accent: expiring30 > 0 ? "warning" : "default",
            drillDomain: "dot",
          },
          {
            id: "dot-activity-in-range",
            label: "Activity (in date range)",
            value: inRange.length,
            drillDomain: "dot",
          },
        ],
        activityTrend: toSeries(trendMap),
        byCategory: toNamed(categoryCounts, DOT_CATEGORY_LABELS),
        byStatus: toNamed(statusCountsAll),
        fleetBreakdown,
        recent,
        warnings,
      };
    });
  }

  async workersComp(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsWorkersComp> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);
    const from = parseDay(filter.from, new Date());
    const to = endOfDayUtc(parseDay(filter.to, new Date()));
    const statusFilter = filter.status?.trim().toLowerCase() || null;
    const severityFilter = filter.severity?.trim().toLowerCase() || null;
    const now = new Date();

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: industrialOpsRecords.id,
          status: industrialOpsRecords.status,
          title: industrialOpsRecords.title,
          payload: industrialOpsRecords.payload,
          createdAt: industrialOpsRecords.createdAt,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, "workers-comp"),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );

      type Enriched = {
        id: string;
        title: string;
        stage: string;
        severity: string;
        workStatus: string;
        department: string;
        facility: string;
        injuryType: string;
        bodyPart: string;
        injuryAt: Date;
        daysOpen: number;
        oshaRecordable: boolean;
        lostTime: boolean;
        open: boolean;
      };

      const enriched: Enriched[] = rows.map((row) => {
        const payload = asPayload(row.payload);
        const classification = asRecord(payload.classification);
        const injuryAt = wcInjuryAt(payload, row.createdAt);
        const stage = wcWorkflowStage(payload, row.status);
        const daysOpen = wcDaysOpen(payload, injuryAt, now);
        const workStatus = String(payload.workStatus ?? "unknown")
          .trim()
          .toLowerCase()
          .replace(/_/g, "-") || "unknown";
        const severity = String(payload.severity ?? "unknown")
          .trim()
          .toLowerCase()
          .replace(/_/g, "-") || "unknown";
        const daysAway =
          typeof payload.daysAway === "number" && Number.isFinite(payload.daysAway)
            ? payload.daysAway
            : 0;
        return {
          id: row.id,
          title: row.title,
          stage,
          severity,
          workStatus,
          department: wcNestedString(
            payload,
            [["department"], ["departmentId"], ["employee", "department"], ["employee", "departmentId"]],
          ),
          facility: wcNestedString(
            payload,
            [["facility"], ["site"], ["employee", "facility"], ["employee", "site"]],
          ),
          injuryType: wcNestedString(payload, [["injuryType"], ["intake", "injuryType"]], "Unknown"),
          bodyPart: wcNestedString(payload, [["bodyPart"], ["intake", "bodyPart"]], "Unknown"),
          injuryAt,
          daysOpen,
          oshaRecordable: wcBool(classification.oshaRecordable),
          lostTime: severity === "lost-time" || daysAway > 0,
          open: wcIsOpen(stage),
        };
      });

      const afterFilters = enriched.filter((r) => {
        if (statusFilter) {
          if (statusFilter === "open") {
            if (!r.open) return false;
          } else if (r.stage !== statusFilter) {
            return false;
          }
        }
        if (severityFilter && r.severity !== severityFilter) return false;
        if (
          filter.facilityId &&
          (!r.facility || r.facility.toLowerCase() !== filter.facilityId.toLowerCase())
        ) {
          return false;
        }
        if (
          filter.departmentId &&
          (!r.department || r.department.toLowerCase() !== filter.departmentId.toLowerCase())
        ) {
          return false;
        }
        return true;
      });

      const openCurrent = afterFilters.filter((r) => r.open).length;
      const inRange = afterFilters.filter((r) => r.injuryAt >= from && r.injuryAt <= to);
      const oshaRecordable = afterFilters.filter((r) => r.oshaRecordable).length;
      const lostTime = afterFilters.filter((r) => r.lostTime).length;
      const open30 = afterFilters.filter((r) => r.open && r.daysOpen > 30).length;
      const open90 = afterFilters.filter((r) => r.open && r.daysOpen > 90).length;

      const statusCounts = new Map<string, number>();
      const deptCounts = new Map<string, number>();
      const facilityCounts = new Map<string, number>();
      const injuryCounts = new Map<string, number>();
      const bodyCounts = new Map<string, number>();
      const workStatusCounts = new Map<string, number>();
      const trendMap = new Map<string, number>();

      for (const row of inRange) {
        statusCounts.set(row.stage, (statusCounts.get(row.stage) ?? 0) + 1);
        deptCounts.set(row.department, (deptCounts.get(row.department) ?? 0) + 1);
        facilityCounts.set(row.facility, (facilityCounts.get(row.facility) ?? 0) + 1);
        injuryCounts.set(row.injuryType, (injuryCounts.get(row.injuryType) ?? 0) + 1);
        bodyCounts.set(row.bodyPart, (bodyCounts.get(row.bodyPart) ?? 0) + 1);
        workStatusCounts.set(row.workStatus, (workStatusCounts.get(row.workStatus) ?? 0) + 1);
        trendMap.set(isoDate(row.injuryAt), (trendMap.get(isoDate(row.injuryAt)) ?? 0) + 1);
      }

      const openCases = afterFilters.filter((r) => r.open);
      const byAging: AnalyticsNamedCount[] = [
        {
          key: "0-30",
          label: "0-30 days",
          count: openCases.filter((r) => r.daysOpen <= 30).length,
        },
        {
          key: "31-60",
          label: "31-60 days",
          count: openCases.filter((r) => r.daysOpen > 30 && r.daysOpen <= 60).length,
        },
        {
          key: "61-90",
          label: "61-90 days",
          count: openCases.filter((r) => r.daysOpen > 60 && r.daysOpen <= 90).length,
        },
        {
          key: "90+",
          label: "90+ days",
          count: openCases.filter((r) => r.daysOpen > 90).length,
        },
      ].filter((r) => r.count > 0);

      const mid = from.getTime() + (to.getTime() - from.getTime()) / 2;
      const recentHalf = inRange.filter((r) => r.injuryAt.getTime() >= mid).length;
      const priorHalf = inRange.length - recentHalf;
      const volumeDelta =
        priorHalf > 0 ? (recentHalf - priorHalf) / priorHalf : recentHalf > 0 ? 1 : null;

      const sortedRecent = [...inRange].sort(
        (a, b) => b.injuryAt.getTime() - a.injuryAt.getTime(),
      );
      const recent: AnalyticsLink[] = sortedRecent.slice(0, 25).map((row) => ({
        rel: "workers-comp",
        module: "workers-comp",
        id: row.id,
        href: "/modules/workers-comp",
        label: row.title || row.id,
      }));

      const warnings: string[] = [];
      if (enriched.length === 0) {
        warnings.push(
          "No Workers' Comp rows in industrial_ops_records (module=workers-comp). Ops create/list path may not expose WC yet — empty KPIs expected until migration.",
        );
      } else if (inRange.length === 0) {
        warnings.push(
          "No WC cases with injury date in the selected range (using intake.incidentDate|incidentDate|createdAt).",
        );
      }
      if (statusFilter || severityFilter) {
        const parts: string[] = [];
        if (statusFilter) parts.push(`status=${statusFilter}`);
        if (severityFilter) parts.push(`severity=${severityFilter}`);
        warnings.push(`Filters applied: ${parts.join(", ")}.`);
      }
      const orgWarn = orgFilterWarning(filter.facilityId, filter.departmentId);
      if (orgWarn && !warnings.includes(orgWarn)) warnings.push(orgWarn);
      warnings.push(
        "Claim cost / incurred KPIs omitted until WC dollar-field analytics policy is decided.",
      );
      warnings.push(
        "Firebase Bridge Safety Intelligence Center remains Analytics SoT until Phase D acceptance.",
      );

      return {
        domain: "workers-comp",
        generatedAt: new Date().toISOString(),
        filter,
        kpis: [
          {
            id: "wc-open-cases",
            label: "Open cases",
            value: openCurrent,
            accent: openCurrent > 0 ? "warning" : "success",
            drillDomain: "workers-comp",
          },
          {
            id: "wc-cases-in-range",
            label: "Cases (in range)",
            value: inRange.length,
            ...(volumeDelta === null ? {} : { delta: Math.round(volumeDelta * 1000) / 1000 }),
            drillDomain: "workers-comp",
          },
          {
            id: "wc-osha-recordable",
            label: "OSHA recordable",
            value: oshaRecordable,
            accent: oshaRecordable > 0 ? "warning" : "default",
            drillDomain: "workers-comp",
          },
          {
            id: "wc-lost-time",
            label: "Lost-time cases",
            value: lostTime,
            accent: lostTime > 0 ? "danger" : "success",
            drillDomain: "workers-comp",
          },
          {
            id: "wc-open-30",
            label: "Open > 30 days",
            value: open30,
            accent: open30 > 0 ? "warning" : "default",
            drillDomain: "workers-comp",
          },
          {
            id: "wc-open-90",
            label: "Open > 90 days",
            value: open90,
            accent: open90 > 0 ? "danger" : "default",
            drillDomain: "workers-comp",
          },
        ],
        injuryTrend: toSeries(trendMap),
        byStatus: toNamed(statusCounts),
        byDepartment: toNamed(deptCounts).slice(0, 8),
        byFacility: toNamed(facilityCounts).slice(0, 8),
        byInjuryType: toNamed(injuryCounts),
        byBodyPart: toNamed(bodyCounts),
        byWorkStatus: toNamed(workStatusCounts),
        byAging,
        recent,
        warnings,
      };
    });
  }

  async intelligence(
    principal: ForgePrincipal,
    query: Record<string, string | undefined>,
  ): Promise<AnalyticsIntelligence> {
    this.assertAccess(principal);
    const filter = defaultFilter(query);
    const from = parseDay(filter.from, new Date());
    const to = endOfDayUtc(parseDay(filter.to, new Date()));
    const statusFilter = filter.status?.trim().toLowerCase() || null;
    const severityFilter = filter.severity?.trim().toLowerCase() || null;
    const midMs = from.getTime() + (to.getTime() - from.getTime()) / 2;
    const mid = new Date(midMs);

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: industrialOpsRecords.id,
          module: industrialOpsRecords.module,
          status: industrialOpsRecords.status,
          title: industrialOpsRecords.title,
          payload: industrialOpsRecords.payload,
          createdAt: industrialOpsRecords.createdAt,
          updatedAt: industrialOpsRecords.updatedAt,
        })
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            isNull(industrialOpsRecords.archivedAt),
          ),
        );

      const byModule = new Map<string, { inRange: number; open: number }>();
      const bodyCounts = new Map<string, number>();
      const categoryCounts = new Map<string, number>();
      const attentionLinks: AnalyticsLink[] = [];
      let incidentsInRange = 0;
      let incidentsRecentHalf = 0;
      let incidentsPriorHalf = 0;
      let openIncidentsCurrent = 0;
      let openLoto = 0;
      let openWc = 0;
      let openTraining = 0;
      let totalInRange = 0;

      for (const row of rows) {
        const payload = asPayload(row.payload);
        if (!matchesOrgGrain(payload, filter.facilityId, filter.departmentId)) continue;
        const mod = row.module;

        if (mod === "incidents" && OPENISH.has(row.status)) {
          if (matchesStatus(row.status, statusFilter) && matchesSeverity(payload, severityFilter)) {
            openIncidentsCurrent += 1;
            if (attentionLinks.length < 25) {
              attentionLinks.push({
                rel: "attention",
                module: "incidents",
                id: row.id,
                href: "/modules/incidents",
                label: row.title || row.id,
              });
            }
          }
        }
        if (mod === "loto" && LOTO_ATTENTION.has(row.status)) {
          openLoto += 1;
        }
        if (mod === "workers-comp") {
          const stage = wcWorkflowStage(payload, row.status);
          if (wcIsOpen(stage)) openWc += 1;
        }
        if (mod === "training" && OPENISH.has(row.status)) {
          openTraining += 1;
        }

        // Date grain: module-specific where known, else createdAt
        let eventAt = row.createdAt;
        if (mod === "incidents") eventAt = incidentEventAt(payload, row.createdAt);
        else if (mod === "inspections") {
          for (const key of ["inspectionDate", "eventDate"] as const) {
            const raw = payload[key];
            if (typeof raw === "string" && raw.trim()) {
              const d = new Date(raw);
              if (!Number.isNaN(d.getTime())) {
                eventAt = d;
                break;
              }
            }
          }
        } else if (mod === "workers-comp") eventAt = wcInjuryAt(payload, row.createdAt);
        else if (mod === "loto") {
          for (const key of ["eventDate", "dueDate"] as const) {
            const raw = payload[key];
            if (typeof raw === "string" && raw.trim()) {
              const d = new Date(raw);
              if (!Number.isNaN(d.getTime())) {
                eventAt = d;
                break;
              }
            }
          }
        }

        if (eventAt < from || eventAt > to) continue;
        if (!matchesStatus(row.status, statusFilter)) continue;
        if (mod === "incidents" && !matchesSeverity(payload, severityFilter)) continue;

        totalInRange += 1;
        const slot = byModule.get(mod) ?? { inRange: 0, open: 0 };
        slot.inRange += 1;
        if (OPENISH.has(row.status) || (mod === "loto" && LOTO_ATTENTION.has(row.status))) {
          slot.open += 1;
        }
        byModule.set(mod, slot);

        if (mod === "incidents") {
          incidentsInRange += 1;
          if (eventAt.getTime() >= midMs) incidentsRecentHalf += 1;
          else incidentsPriorHalf += 1;
          const cat = normalizeCategory(payload);
          categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
          const body = String(payload.bodyPart ?? asRecord(payload.intake).bodyPart ?? "")
            .trim();
          if (body) bodyCounts.set(body, (bodyCounts.get(body) ?? 0) + 1);
        }
      }

      const moduleActivity: AnalyticsModuleActivity[] = [...byModule.entries()]
        .map(([module, stats]) => ({
          module,
          label: MODULE_LABELS[module] ?? module,
          inRange: stats.inRange,
          open: stats.open,
        }))
        .sort((a, b) => b.inRange - a.inRange);

      const topCategories = toNamed(categoryCounts, CATEGORY_LABELS).slice(0, 8);
      const injuriesByBodyPart: AnalyticsBodyPartCount[] = [...bodyCounts.entries()]
        .map(([bodyPart, count]) => ({ bodyPart, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const findings: AnalyticsFinding[] = [];

      findings.push({
        id: "window",
        severity: "info",
        summary: `Analysis window ${filter.from} through ${filter.to} (${totalInRange} in-range records across ${moduleActivity.length} modules).`,
        evidence: [
          { kind: "window", label: "from", value: filter.from },
          { kind: "window", label: "to", value: filter.to },
          { kind: "count", label: "recordsInRange", value: totalInRange },
          { kind: "count", label: "modulesWithActivity", value: moduleActivity.length },
        ],
      });

      if (openIncidentsCurrent > 0) {
        findings.push({
          id: "open-incidents",
          severity: openIncidentsCurrent >= 5 ? "critical" : "attention",
          summary: `${openIncidentsCurrent} open incident${openIncidentsCurrent === 1 ? "" : "s"} (current, not date-scoped).`,
          evidence: [
            {
              kind: "kpi",
              id: "open-incidents-current",
              module: "incidents",
              label: "Open incidents (current)",
              value: openIncidentsCurrent,
              href: "/modules/incidents",
            },
          ],
          drillDomain: "incidents",
        });
      } else if (
        rows.some(
          (r) =>
            r.module === "incidents" &&
            matchesOrgGrain(asPayload(r.payload), filter.facilityId, filter.departmentId),
        )
      ) {
        findings.push({
          id: "open-incidents-zero",
          severity: "info",
          summary: "0 open incidents currently (status in open/under-review/pending/draft/active).",
          evidence: [
            {
              kind: "kpi",
              id: "open-incidents-current",
              module: "incidents",
              label: "Open incidents (current)",
              value: 0,
            },
          ],
          drillDomain: "incidents",
        });
      }

      if (incidentsInRange > 0 && incidentsPriorHalf > 0 && incidentsRecentHalf > incidentsPriorHalf) {
        const delta =
          Math.round(((incidentsRecentHalf - incidentsPriorHalf) / incidentsPriorHalf) * 1000) / 1000;
        findings.push({
          id: "incident-volume-rising",
          severity: delta >= 0.5 ? "critical" : "attention",
          summary: `Incident volume higher in the recent half of the window (${incidentsRecentHalf}) than the prior half (${incidentsPriorHalf}).`,
          evidence: [
            { kind: "window", label: "priorHalfEnd", value: isoDate(mid) },
            { kind: "count", id: "incidents-prior-half", label: "Prior half", value: incidentsPriorHalf },
            {
              kind: "count",
              id: "incidents-recent-half",
              label: "Recent half",
              value: incidentsRecentHalf,
            },
            { kind: "kpi", id: "half-over-half-delta", label: "Relative change", value: delta },
          ],
          drillDomain: "incidents",
        });
      }

      const topBody = injuriesByBodyPart[0];
      if (topBody && topBody.count >= 3) {
        findings.push({
          id: "repeat-body-part",
          severity: topBody.count >= 5 ? "critical" : "attention",
          summary: `${topBody.count} in-range incidents list body part "${topBody.bodyPart}".`,
          evidence: [
            {
              kind: "count",
              id: "body-part",
              module: "incidents",
              label: topBody.bodyPart,
              value: topBody.count,
            },
            {
              kind: "count",
              label: "incidentsInRange",
              module: "incidents",
              value: incidentsInRange,
            },
          ],
          drillDomain: "incidents",
        });
      }

      const topModule = moduleActivity[0];
      if (topModule && topModule.inRange > 0) {
        findings.push({
          id: "top-module-activity",
          severity: "info",
          summary: `Most active module in range: ${topModule.label} (${topModule.inRange}).`,
          evidence: [
            {
              kind: "module",
              module: topModule.module,
              label: topModule.label,
              value: topModule.inRange,
            },
          ],
        });
      }

      if (openLoto > 0) {
        findings.push({
          id: "open-loto",
          severity: openLoto >= 5 ? "critical" : "attention",
          summary: `${openLoto} LOTO record${openLoto === 1 ? "" : "s"} in attention statuses (current).`,
          evidence: [
            {
              kind: "kpi",
              id: "loto-open",
              module: "loto",
              label: "Open / attention LOTO",
              value: openLoto,
              href: "/modules/loto",
            },
          ],
          drillDomain: "loto",
        });
      }

      if (openWc > 0) {
        findings.push({
          id: "open-wc",
          severity: openWc >= 5 ? "critical" : "attention",
          summary: `${openWc} open Workers' Comp case${openWc === 1 ? "" : "s"} (workflowStage ≠ closed).`,
          evidence: [
            {
              kind: "kpi",
              id: "wc-open-cases",
              module: "workers-comp",
              label: "Open WC cases",
              value: openWc,
              href: "/modules/workers-comp",
            },
          ],
          drillDomain: "workers-comp",
        });
      }

      if (openTraining > 0) {
        findings.push({
          id: "open-training",
          severity: "attention",
          summary: `${openTraining} training record${openTraining === 1 ? "" : "s"} currently in open-ish statuses.`,
          evidence: [
            {
              kind: "kpi",
              id: "training-open",
              module: "training",
              label: "Open training",
              value: openTraining,
              href: "/modules/training",
            },
          ],
          drillDomain: "personnel",
        });
      }

      const warnings: string[] = [];
      if (rows.length === 0) {
        warnings.push("No industrial_ops_records for this tenant — intelligence findings are empty.");
      } else if (totalInRange === 0) {
        warnings.push("No records fall in the selected date range for cross-module activity.");
      }
      if (statusFilter || severityFilter) {
        const bits = [
          statusFilter ? `status=${statusFilter}` : null,
          severityFilter ? `severity=${severityFilter}` : null,
        ].filter(Boolean);
        warnings.push(
          `Filters applied: ${bits.join(", ")}. Severity constrains incidents (and WC when domain-local); status applies broadly.`,
        );
      }
      const orgWarn = orgFilterWarning(filter.facilityId, filter.departmentId);
      if (orgWarn && !warnings.includes(orgWarn)) warnings.push(orgWarn);
      warnings.push(
        "Findings only include templated paraphrases of cited evidence — no generative / unsupported conclusions.",
      );
      warnings.push(
        "Firebase Bridge Safety Intelligence Center remains Analytics SoT until Phase D acceptance.",
      );

      return {
        domain: "intelligence",
        generatedAt: new Date().toISOString(),
        filter,
        kpis: [
          {
            id: "intel-records-in-range",
            label: "Records (in range)",
            value: totalInRange,
            drillDomain: "intelligence",
          },
          {
            id: "intel-open-incidents",
            label: "Open incidents",
            value: openIncidentsCurrent,
            accent: openIncidentsCurrent > 0 ? "warning" : "success",
            drillDomain: "incidents",
          },
          {
            id: "intel-open-loto",
            label: "Open LOTO",
            value: openLoto,
            accent: openLoto > 0 ? "warning" : "success",
            drillDomain: "loto",
          },
          {
            id: "intel-open-wc",
            label: "Open WC cases",
            value: openWc,
            accent: openWc > 0 ? "warning" : "default",
            drillDomain: "workers-comp",
          },
          {
            id: "intel-findings",
            label: "Evidence findings",
            value: findings.length,
            drillDomain: "intelligence",
          },
        ],
        moduleActivity,
        findings,
        injuriesByBodyPart,
        topCategories,
        recentAttention: attentionLinks,
        warnings,
      };
    });
  }
}
