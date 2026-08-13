"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ANALYTICS_SEVERITY_OPTIONS,
  ANALYTICS_STATUS_OPTIONS,
  INDUSTRIAL_MODULE_REGISTRY,
  INDUSTRIAL_PRODUCT_CODE,
  type AnalyticsIncidents,
  type AnalyticsInspections,
  type AnalyticsLoto,
  type AnalyticsDot,
  type AnalyticsWorkersComp,
  type AnalyticsIntelligence,
  type AnalyticsFinding,
  type AnalyticsFilterOptions,
  type AnalyticsFilterOption,
  type AnalyticsPersonnel,
  type AnalyticsKpi,
  type AnalyticsNamedCount,
  type AnalyticsOverview,
  type AnalyticsSeriesPoint,
} from "@forge/contracts";
import { apiGet, useAuth } from "@forge/web-kit";
import { useAnalyticsFilter } from "@/hooks/use-analytics-filter";
import { buildAnalyticsCsv, downloadTextFile } from "@/lib/analytics-csv";
import { buildIndustrialNavigation } from "@/lib/navigation";
import { PageHeader } from "@/components/layout/page-chrome";

function formatDelta(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return null;
  const pct = Math.round(delta * 100);
  if (pct === 0) return "±0% vs prior half";
  return `${pct > 0 ? "+" : ""}${pct}% vs prior half`;
}

function KpiGrid({
  kpis,
  loading,
  error,
}: {
  kpis: AnalyticsKpi[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="row g-3 mb-3">
      {kpis.map((kpi) => (
        <div className="col-12 col-sm-6 col-lg-3" key={kpi.id}>
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase small">{kpi.label}</div>
              <div className="fw-semibold text-body mt-1 fs-5">
                {kpi.value === null || kpi.value === undefined ? "—" : kpi.value}
                {kpi.unit ? ` ${kpi.unit}` : ""}
              </div>
              {formatDelta(kpi.delta) ? (
                <div className="small text-muted">{formatDelta(kpi.delta)}</div>
              ) : null}
              {kpi.drillDomain === "incidents" ? (
                <Link className="small" href="/modules/incidents">
                  Open Incidents
                </Link>
              ) : kpi.drillDomain === "inspections" ? (
                <Link className="small" href="/modules/inspections">
                  Open Inspections
                </Link>
              ) : kpi.drillDomain === "personnel" ? (
                <Link className="small" href="/modules/personnel">
                  Open Personnel
                </Link>
              ) : kpi.drillDomain === "loto" ? (
                <Link className="small" href="/modules/loto">
                  Open LOTO
                </Link>
              ) : kpi.drillDomain === "dot" ? (
                <Link className="small" href="/modules/dot-compliance">
                  Open DOT
                </Link>
              ) : kpi.drillDomain === "workers-comp" ? (
                <Link className="small" href="/modules/workers-comp">
                  Open Workers&apos; Comp
                </Link>
              ) : kpi.drillDomain === "intelligence" ? (
                <span className="small text-muted">Cross-module</span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {!loading && !error && kpis.length === 0 ? (
        <div className="col-12">
          <p className="text-muted small mb-0">No KPI rows returned for this range.</p>
        </div>
      ) : null}
    </div>
  );
}

function NamedCountTable({
  title,
  rows,
  keyHeader,
}: {
  title: string;
  rows: AnalyticsNamedCount[];
  keyHeader: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="col-12 col-md-6">
      <h3 className="h6 mb-2">{title}</h3>
      <div className="table-responsive mb-3">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{keyHeader}</th>
              <th className="text-end">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="text-end">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendTable({ title, points }: { title: string; points: AnalyticsSeriesPoint[] }) {
  if (points.length === 0) return null;
  return (
    <div className="col-12">
      <h3 className="h6 mb-2">{title}</h3>
      <div className="table-responsive mb-3">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Day</th>
              <th className="text-end">Count</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.bucket}>
                <td>{p.bucket}</td>
                <td className="text-end">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Combined Industrial Dashboard: Core overview + Analytics (Phase C shared filters).
 */
export function IndustrialDashboard() {
  const { me, hasPermission } = useAuth();
  const { filter, panel, hydrated, savedViews, setPanel, applyFilter, saveView, applySavedView, deleteSavedView, queryString } =
    useAnalyticsFilter();
  const entitled = Boolean(me?.activeProducts?.includes(INDUSTRIAL_PRODUCT_CODE));
  const nav = buildIndustrialNavigation({
    entitled,
    permissions: me?.isPlatformAdmin
      ? ["industrial.access", ...(me?.permissions ?? [])]
      : (me?.permissions ?? []),
    flags: Object.fromEntries(
      (me?.activeModules ?? []).map((code) => [
        `industrial.module.${code.toLowerCase()}.enabled`,
        true,
      ]),
    ),
  });

  const available = nav.filter((n) => n.available && n.code !== "CORE");
  const featured =
    available.length > 0
      ? available.slice(0, 12)
      : INDUSTRIAL_MODULE_REGISTRY.filter((m) => m.code !== "CORE").slice(0, 12);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [incidents, setIncidents] = useState<AnalyticsIncidents | null>(null);
  const [inspections, setInspections] = useState<AnalyticsInspections | null>(null);
  const [personnel, setPersonnel] = useState<AnalyticsPersonnel | null>(null);
  const [loto, setLoto] = useState<AnalyticsLoto | null>(null);
  const [dot, setDot] = useState<AnalyticsDot | null>(null);
  const [workersComp, setWorkersComp] = useState<AnalyticsWorkersComp | null>(null);
  const [intelligence, setIntelligence] = useState<AnalyticsIntelligence | null>(null);
  const [filterOptions, setFilterOptions] = useState<AnalyticsFilterOptions | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!me?.tenantId || !hydrated) {
      setOverview(null);
      setIncidents(null);
      setInspections(null);
      setPersonnel(null);
      setLoto(null);
      setDot(null);
      setWorkersComp(null);
      setIntelligence(null);
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      if (panel === "overview") {
        const data = await apiGet<AnalyticsOverview>(
          `/api/v1/industrial/analytics/overview?${queryString}`,
        );
        setOverview(data);
      } else if (panel === "incidents") {
        const data = await apiGet<AnalyticsIncidents>(
          `/api/v1/industrial/analytics/incidents?${queryString}`,
        );
        setIncidents(data);
      } else if (panel === "inspections") {
        const data = await apiGet<AnalyticsInspections>(
          `/api/v1/industrial/analytics/inspections?${queryString}`,
        );
        setInspections(data);
      } else if (panel === "personnel") {
        const data = await apiGet<AnalyticsPersonnel>(
          `/api/v1/industrial/analytics/personnel?${queryString}`,
        );
        setPersonnel(data);
      } else if (panel === "loto") {
        const data = await apiGet<AnalyticsLoto>(
          `/api/v1/industrial/analytics/loto?${queryString}`,
        );
        setLoto(data);
      } else if (panel === "dot") {
        const data = await apiGet<AnalyticsDot>(
          `/api/v1/industrial/analytics/dot?${queryString}`,
        );
        setDot(data);
      } else if (panel === "workers-comp") {
        const data = await apiGet<AnalyticsWorkersComp>(
          `/api/v1/industrial/analytics/workers-comp?${queryString}`,
        );
        setWorkersComp(data);
      } else {
        const data = await apiGet<AnalyticsIntelligence>(
          `/api/v1/industrial/analytics/intelligence?${queryString}`,
        );
        setIntelligence(data);
      }
    } catch (err) {
      if (panel === "overview") setOverview(null);
      else if (panel === "incidents") setIncidents(null);
      else if (panel === "inspections") setInspections(null);
      else if (panel === "personnel") setPersonnel(null);
      else if (panel === "loto") setLoto(null);
      else if (panel === "dot") setDot(null);
      else if (panel === "workers-comp") setWorkersComp(null);
      else setIntelligence(null);
      setAnalyticsError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [me?.tenantId, hydrated, panel, queryString]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!me?.tenantId || !hydrated) {
      setFilterOptions(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<AnalyticsFilterOptions>(
          `/api/v1/industrial/analytics/filter-options?${queryString}`,
        );
        if (!cancelled) setFilterOptions(data);
      } catch {
        if (!cancelled) setFilterOptions(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.tenantId, hydrated, queryString]);

  const onApplyFilters = (event: FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    applyFilter({
      ...filter,
      from: String(fd.get("from") ?? filter.from),
      to: String(fd.get("to") ?? filter.to),
      severity: String(fd.get("severity") || "") || null,
      status: String(fd.get("status") || "") || null,
      facilityId: String(fd.get("facilityId") || "") || null,
      departmentId: String(fd.get("departmentId") || "") || null,
    });
  };

  const warnings = useMemo(() => {
    if (panel === "incidents") return incidents?.warnings ?? [];
    if (panel === "inspections") return inspections?.warnings ?? [];
    if (panel === "personnel") return personnel?.warnings ?? [];
    if (panel === "loto") return loto?.warnings ?? [];
    if (panel === "dot") return dot?.warnings ?? [];
    if (panel === "workers-comp") return workersComp?.warnings ?? [];
    if (panel === "intelligence") return intelligence?.warnings ?? [];
    return overview?.warnings ?? [];
  }, [panel, overview, incidents, inspections, personnel, loto, dot, workersComp, intelligence]);

  const activeKpis =
    panel === "incidents"
      ? (incidents?.kpis ?? [])
      : panel === "inspections"
        ? (inspections?.kpis ?? [])
        : panel === "personnel"
          ? (personnel?.kpis ?? [])
          : panel === "loto"
            ? (loto?.kpis ?? [])
            : panel === "dot"
              ? (dot?.kpis ?? [])
              : panel === "workers-comp"
                ? (workersComp?.kpis ?? [])
                : panel === "intelligence"
                  ? (intelligence?.kpis ?? [])
                  : (overview?.kpis ?? []);

  const formKey = `${filter.from}|${filter.to}|${filter.severity ?? ""}|${filter.status ?? ""}|${filter.facilityId ?? ""}|${filter.departmentId ?? ""}`;

  const facilityChoices: AnalyticsFilterOption[] = filterOptions?.facilities ?? [];
  const departmentChoices: AnalyticsFilterOption[] = filterOptions?.departments ?? [];

  const onExportCsv = () => {
    const base = { from: filter.from, to: filter.to, warnings };
    let csv = "";
    if (panel === "overview" && overview) {
      csv = buildAnalyticsCsv({
        domain: "overview",
        ...base,
        kpis: overview.kpis,
        tables: [
          { title: "Incidents by category", rows: overview.incidentsByCategory },
          { title: "Inspections by site", rows: overview.inspectionsBySite },
          {
            title: "Module activity",
            rows: overview.moduleActivity.map((m) => ({
              key: m.module,
              label: m.label,
              count: m.inRange,
            })),
          },
        ],
        trends: [
          { title: "Incident trend", points: overview.incidentTrend },
          { title: "Inspection trend", points: overview.inspectionTrend },
          { title: "Observations trend", points: overview.observationsTrend },
        ],
      });
    } else if (panel === "incidents" && incidents) {
      csv = buildAnalyticsCsv({
        domain: "incidents",
        ...base,
        kpis: incidents.kpis,
        tables: [
          { title: "By category", rows: incidents.byCategory },
          { title: "By severity", rows: incidents.bySeverity },
        ],
        trends: [{ title: "Incident trend", points: incidents.incidentTrend }],
        bodyParts: incidents.injuriesByBodyPart,
      });
    } else if (panel === "inspections" && inspections) {
      csv = buildAnalyticsCsv({
        domain: "inspections",
        ...base,
        kpis: inspections.kpis,
        tables: [
          { title: "By site", rows: inspections.bySite },
          { title: "By status", rows: inspections.byStatus },
        ],
        trends: [{ title: "Inspection trend", points: inspections.inspectionTrend }],
      });
    } else if (panel === "personnel" && personnel) {
      csv = buildAnalyticsCsv({
        domain: "personnel",
        ...base,
        kpis: personnel.kpis,
        tables: [{ title: "By status", rows: personnel.byStatus }],
        trends: [{ title: "Training trend", points: personnel.trainingTrend }],
      });
    } else if (panel === "loto" && loto) {
      csv = buildAnalyticsCsv({
        domain: "loto",
        ...base,
        kpis: loto.kpis,
        tables: [
          { title: "By status", rows: loto.byStatus },
          { title: "By site", rows: loto.bySite },
          { title: "By category", rows: loto.byCategory },
        ],
        trends: [{ title: "LOTO activity trend", points: loto.activityTrend }],
      });
    } else if (panel === "dot" && dot) {
      csv = buildAnalyticsCsv({
        domain: "dot",
        ...base,
        kpis: dot.kpis,
        tables: [
          { title: "Fleet breakdown", rows: dot.fleetBreakdown },
          { title: "By category", rows: dot.byCategory },
          { title: "By status", rows: dot.byStatus },
        ],
        trends: [{ title: "DOT activity trend", points: dot.activityTrend }],
      });
    } else if (panel === "workers-comp" && workersComp) {
      csv = buildAnalyticsCsv({
        domain: "workers-comp",
        ...base,
        kpis: workersComp.kpis,
        tables: [
          { title: "Open-case aging", rows: workersComp.byAging },
          { title: "By department", rows: workersComp.byDepartment },
          { title: "By facility", rows: workersComp.byFacility },
          { title: "By injury type", rows: workersComp.byInjuryType },
          { title: "By body part", rows: workersComp.byBodyPart },
          { title: "By work status", rows: workersComp.byWorkStatus },
          { title: "By workflow stage", rows: workersComp.byStatus },
        ],
        trends: [{ title: "Injury trend", points: workersComp.injuryTrend }],
      });
    } else if (panel === "intelligence" && intelligence) {
      csv = buildAnalyticsCsv({
        domain: "intelligence",
        ...base,
        kpis: intelligence.kpis,
        tables: [
          {
            title: "Activity by module",
            rows: intelligence.moduleActivity.map((m) => ({
              key: m.module,
              label: m.label,
              count: m.inRange,
            })),
          },
          { title: "Top incident categories", rows: intelligence.topCategories },
        ],
        bodyParts: intelligence.injuriesByBodyPart,
        findings: intelligence.findings.map((f) => ({
          id: f.id,
          severity: f.severity,
          summary: f.summary,
        })),
      });
    } else {
      return;
    }
    downloadTextFile(`industrial-analytics-${panel}-${filter.from}_${filter.to}.csv`, csv);
  };

  return (
    <div className="ind-dashboard">
      <PageHeader
        as="h1"
        title="Dashboard"
        description={
          me?.tenantId
            ? "Overview of authorized modules and safety analytics for your tenant."
            : "Sign in and select a tenant to see authorized modules."
        }
        actions={
          <>
            <Link className="btn btn-sm btn-outline-primary" href="/modules/personnel">
              Personnel
            </Link>
            <Link className="btn btn-sm btn-outline-primary" href="/modules/incidents">
              Incidents
            </Link>
            <Link className="btn btn-sm btn-outline-secondary" href="/settings/">
              Settings
            </Link>
          </>
        }
      />

      <h2 className="h5 mb-3">Overview</h2>
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase small">Product</div>
              <div className="fw-semibold">Forge Industrial Safety</div>
              <div className="small text-muted mt-1">
                {entitled ? "Entitled" : "Not entitled on this tenant"}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase small">Access</div>
              <div className="fw-semibold">
                {hasPermission("industrial.access") ? "industrial.access" : "Restricted"}
              </div>
              <div className="small text-muted mt-1">
                {me?.isPlatformAdmin ? "Platform admin" : "Tenant membership"}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase small">Modules visible</div>
              <div className="fw-semibold">{available.length || "—"}</div>
              <div className="small text-muted mt-1">After permission and flag filters</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="h5 mb-3">Module launcher</h2>
      <div className="row g-3 mb-4">
        {featured.map((mod) => {
          const code = "code" in mod ? mod.code : (mod as { code: string }).code;
          const name = "name" in mod ? mod.name : code;
          const route = "route" in mod ? mod.route : `/modules/${String(code).toLowerCase()}`;
          const meta =
            "migrationStatus" in mod
              ? String((mod as { migrationStatus: string }).migrationStatus)
              : "FOUNDATION";
          const availableFlag =
            "available" in mod ? Boolean((mod as { available?: boolean }).available) : true;
          return (
            <div className="col-12 col-sm-6 col-lg-4 col-xl-3" key={code}>
              {availableFlag ? (
                <Link href={route} className="card h-100 text-decoration-none">
                  <div className="card-body">
                    <h3 className="h6 mb-1 text-body">{name}</h3>
                    <p className="small text-muted mb-0">{meta}</p>
                  </div>
                </Link>
              ) : (
                <div className="card h-100 opacity-50">
                  <div className="card-body">
                    <h3 className="h6 mb-1">{name}</h3>
                    <p className="small text-muted mb-0">Unavailable · {meta}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section
        className="ind-dashboard-analytics"
        aria-labelledby="dashboard-analytics-title"
        data-analytics-print="true"
      >
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <h2 id="dashboard-analytics-title" className="h5 mb-1">
              Analytics
            </h2>
            <p className="text-muted mb-0 small">
              Shared filter context across domains. Firebase Bridge remains Analytics SoT until Phase
              D acceptance.
            </p>
          </div>
          {panel === "overview" &&
          overview?.safetyScore !== null &&
          overview?.safetyScore !== undefined ? (
            <span className="badge bg-label-primary">
              Safety Index {overview.safetyScore}
              {overview.safetyGrade ? ` · ${overview.safetyGrade}` : ""}
            </span>
          ) : panel === "overview" ? (
            <span className="badge bg-label-secondary">No score yet</span>
          ) : null}
        </div>

        <div className="btn-group mb-3" role="group" aria-label="Analytics domain">
          <button
            type="button"
            className={`btn btn-sm ${panel === "overview" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setPanel("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={`btn btn-sm ${panel === "incidents" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setPanel("incidents")}
          >
            Incidents
          </button>
          <button
            type="button"
            className={`btn btn-sm ${panel === "inspections" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setPanel("inspections")}
          >
            Inspections
          </button>
          <button
            type="button"
            className={`btn btn-sm ${panel === "personnel" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setPanel("personnel")}
          >
            Personnel
          </button>
          <button
            type="button"
            className={`btn btn-sm ${panel === "loto" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setPanel("loto")}
          >
            LOTO
          </button>
          <button
            type="button"
            className={`btn btn-sm ${panel === "dot" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setPanel("dot")}
          >
            DOT
          </button>
          <button
            type="button"
            className={`btn btn-sm ${panel === "workers-comp" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setPanel("workers-comp")}
          >
            Workers&apos; Comp
          </button>
          <button
            type="button"
            className={`btn btn-sm ${panel === "intelligence" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setPanel("intelligence")}
          >
            Intelligence
          </button>
        </div>

        <form className="row g-2 align-items-end mb-3" key={formKey} onSubmit={onApplyFilters}>
          <div className="col-auto">
            <label className="form-label small mb-1" htmlFor="analytics-from">
              From
            </label>
            <input
              id="analytics-from"
              name="from"
              type="date"
              className="form-control form-control-sm"
              defaultValue={filter.from}
            />
          </div>
          <div className="col-auto">
            <label className="form-label small mb-1" htmlFor="analytics-to">
              To
            </label>
            <input
              id="analytics-to"
              name="to"
              type="date"
              className="form-control form-control-sm"
              defaultValue={filter.to}
            />
          </div>
          <div className="col-auto">
            <label className="form-label small mb-1" htmlFor="analytics-severity">
              Severity
            </label>
            <select
              id="analytics-severity"
              name="severity"
              className="form-select form-select-sm"
              defaultValue={filter.severity ?? ""}
            >
              <option value="">All</option>
              {ANALYTICS_SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <label className="form-label small mb-1" htmlFor="analytics-status">
              Status
            </label>
            <select
              id="analytics-status"
              name="status"
              className="form-select form-select-sm"
              defaultValue={filter.status ?? ""}
            >
              <option value="">All</option>
              {ANALYTICS_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <label className="form-label small mb-1" htmlFor="analytics-facility">
              Facility
            </label>
            <select
              id="analytics-facility"
              name="facilityId"
              className="form-select form-select-sm"
              defaultValue={filter.facilityId ?? ""}
            >
              <option value="">All</option>
              {facilityChoices.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <label className="form-label small mb-1" htmlFor="analytics-department">
              Department
            </label>
            <select
              id="analytics-department"
              name="departmentId"
              className="form-select form-select-sm"
              defaultValue={filter.departmentId ?? ""}
            >
              <option value="">All</option>
              {departmentChoices.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <button type="submit" className="btn btn-sm btn-primary" disabled={analyticsLoading}>
              {analyticsLoading ? "Loading…" : "Apply"}
            </button>
          </div>
          <div className="col-auto">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={analyticsLoading || activeKpis.length === 0}
              onClick={onExportCsv}
            >
              Export CSV
            </button>
          </div>
          <div className="col-auto">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={analyticsLoading || activeKpis.length === 0}
              onClick={() => window.print()}
              title="Use the browser print dialog → Save as PDF. Full Reporting/GAP-RPT-01 PDF remains deferred."
            >
              Print / PDF
            </button>
          </div>
          <div className="col-auto">
            <label className="form-label small mb-1" htmlFor="analytics-saved-view">
              Saved view
            </label>
            <select
              id="analytics-saved-view"
              className="form-select form-select-sm"
              value=""
              onChange={(event) => {
                const id = event.target.value;
                if (id) applySavedView(id);
              }}
            >
              <option value="">Load…</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name} ({view.panel})
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => {
                const name = window.prompt("Name for this analytics view?");
                if (!name) return;
                saveView(name);
              }}
            >
              Save view
            </button>
          </div>
          {savedViews.length > 0 ? (
            <div className="col-auto">
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => {
                  const first = savedViews[0];
                  if (!first) return;
                  const ok = window.confirm(`Delete saved view "${first.name}"?`);
                  if (ok) deleteSavedView(first.id);
                }}
                title="Deletes the most recently saved view"
              >
                Delete last
              </button>
            </div>
          ) : null}
        </form>

        {analyticsError ? <p className="text-danger small">{analyticsError}</p> : null}
        {warnings.map((w) => (
          <p key={w} className="text-muted small mb-1">
            {w}
          </p>
        ))}

        <KpiGrid kpis={activeKpis} loading={analyticsLoading} error={analyticsError} />

        {panel === "overview" && (overview?.moduleActivity?.length ?? 0) > 0 ? (
          <>
            <h3 className="h6 mb-2">Module activity (in range)</h3>
            <div className="table-responsive mb-3">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th className="text-end">In range</th>
                    <th className="text-end">Open-ish</th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.moduleActivity.map((row) => (
                    <tr key={row.module}>
                      <td>{row.label}</td>
                      <td className="text-end">{row.inRange}</td>
                      <td className="text-end">{row.open ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {panel === "personnel" ? (
          <div className="row g-3">
            <NamedCountTable
              title="Training by status"
              rows={personnel?.byStatus ?? []}
              keyHeader="Status"
            />
            <TrendTable title="Training trend" points={personnel?.trainingTrend ?? []} />
            {(personnel?.recent?.length ?? 0) > 0 ? (
              <div className="col-12">
                <h3 className="h6 mb-2">Recent training in range</h3>
                <ul className="list-unstyled mb-0">
                  {personnel?.recent.map((link) => (
                    <li key={link.id} className="mb-1">
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {panel === "loto" ? (
          <div className="row g-3">
            <NamedCountTable title="By status" rows={loto?.byStatus ?? []} keyHeader="Status" />
            <NamedCountTable title="By site" rows={loto?.bySite ?? []} keyHeader="Site" />
            <NamedCountTable
              title="By category"
              rows={loto?.byCategory ?? []}
              keyHeader="Category"
            />
            <TrendTable title="LOTO activity trend" points={loto?.activityTrend ?? []} />
            {(loto?.recent?.length ?? 0) > 0 ? (
              <div className="col-12">
                <h3 className="h6 mb-2">Recent in range</h3>
                <ul className="list-unstyled mb-0">
                  {loto?.recent.map((link) => (
                    <li key={link.id} className="mb-1">
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {panel === "dot" ? (
          <div className="row g-3">
            <NamedCountTable
              title="Fleet breakdown"
              rows={dot?.fleetBreakdown ?? []}
              keyHeader="Bucket"
            />
            <NamedCountTable
              title="By category"
              rows={dot?.byCategory ?? []}
              keyHeader="Category"
            />
            <NamedCountTable title="By status" rows={dot?.byStatus ?? []} keyHeader="Status" />
            <TrendTable title="DOT activity trend" points={dot?.activityTrend ?? []} />
            {(dot?.recent?.length ?? 0) > 0 ? (
              <div className="col-12">
                <h3 className="h6 mb-2">Recent activity in range</h3>
                <ul className="list-unstyled mb-0">
                  {dot?.recent.map((link) => (
                    <li key={link.id} className="mb-1">
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {panel === "workers-comp" ? (
          <div className="row g-3">
            <NamedCountTable
              title="Open-case aging"
              rows={workersComp?.byAging ?? []}
              keyHeader="Band"
            />
            <NamedCountTable
              title="By department"
              rows={workersComp?.byDepartment ?? []}
              keyHeader="Department"
            />
            <NamedCountTable
              title="By facility"
              rows={workersComp?.byFacility ?? []}
              keyHeader="Facility"
            />
            <NamedCountTable
              title="By injury type"
              rows={workersComp?.byInjuryType ?? []}
              keyHeader="Injury type"
            />
            <NamedCountTable
              title="By body part"
              rows={workersComp?.byBodyPart ?? []}
              keyHeader="Body part"
            />
            <NamedCountTable
              title="By work status"
              rows={workersComp?.byWorkStatus ?? []}
              keyHeader="Work status"
            />
            <NamedCountTable
              title="By workflow stage"
              rows={workersComp?.byStatus ?? []}
              keyHeader="Stage"
            />
            <TrendTable title="Injury trend" points={workersComp?.injuryTrend ?? []} />
            {(workersComp?.recent?.length ?? 0) > 0 ? (
              <div className="col-12">
                <h3 className="h6 mb-2">Recent cases in range</h3>
                <ul className="list-unstyled mb-0">
                  {workersComp?.recent.map((link) => (
                    <li key={link.id} className="mb-1">
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {panel === "intelligence" ? (
          <div className="row g-3">
            <div className="col-12">
              <h3 className="h6 mb-2">Evidence findings</h3>
              {(intelligence?.findings?.length ?? 0) === 0 ? (
                <p className="small text-muted mb-0">No findings for this window.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {intelligence?.findings.map((finding: AnalyticsFinding) => (
                    <li key={finding.id} className="border rounded p-3 mb-2">
                      <div className="d-flex flex-wrap justify-content-between gap-2">
                        <div className="fw-semibold">{finding.summary}</div>
                        <span
                          className={`badge ${
                            finding.severity === "critical"
                              ? "bg-label-danger"
                              : finding.severity === "attention"
                                ? "bg-label-warning"
                                : "bg-label-secondary"
                          }`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      <ul className="small text-muted mb-0 mt-2">
                        {finding.evidence.map((ev, idx) => (
                          <li key={`${finding.id}-ev-${idx}`}>
                            {ev.label}
                            {ev.value !== null && ev.value !== undefined ? `: ${ev.value}` : ""}
                            {ev.href ? (
                              <>
                                {" "}
                                <Link href={ev.href}>open</Link>
                              </>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <NamedCountTable
              title="Activity by module"
              rows={(intelligence?.moduleActivity ?? []).map((m) => ({
                key: m.module,
                label: m.label,
                count: m.inRange,
              }))}
              keyHeader="Module"
            />
            <NamedCountTable
              title="Top incident categories"
              rows={intelligence?.topCategories ?? []}
              keyHeader="Category"
            />
            {(intelligence?.injuriesByBodyPart?.length ?? 0) > 0 ? (
              <div className="col-12 col-md-6">
                <h3 className="h6 mb-2">Injuries by body part</h3>
                <div className="table-responsive mb-3">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Body part</th>
                        <th className="text-end">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intelligence?.injuriesByBodyPart.map((row) => (
                        <tr key={row.bodyPart}>
                          <td>{row.bodyPart}</td>
                          <td className="text-end">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {(intelligence?.recentAttention?.length ?? 0) > 0 ? (
              <div className="col-12">
                <h3 className="h6 mb-2">Open incidents (sample)</h3>
                <ul className="list-unstyled mb-0">
                  {intelligence?.recentAttention.map((link) => (
                    <li key={link.id} className="mb-1">
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {panel === "inspections" ? (
          <div className="row g-3">
            <NamedCountTable title="By site" rows={inspections?.bySite ?? []} keyHeader="Site" />
            <NamedCountTable
              title="By status"
              rows={inspections?.byStatus ?? []}
              keyHeader="Status"
            />
            <TrendTable title="Inspection trend" points={inspections?.inspectionTrend ?? []} />
            {(inspections?.recent?.length ?? 0) > 0 ? (
              <div className="col-12">
                <h3 className="h6 mb-2">Recent in range</h3>
                <ul className="list-unstyled mb-0">
                  {inspections?.recent.map((link) => (
                    <li key={link.id} className="mb-1">
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {panel === "incidents" ? (
          <div className="row g-3">
            <NamedCountTable
              title="By category"
              rows={incidents?.byCategory ?? []}
              keyHeader="Category"
            />
            <NamedCountTable
              title="By severity"
              rows={incidents?.bySeverity ?? []}
              keyHeader="Severity"
            />
            {(incidents?.injuriesByBodyPart?.length ?? 0) > 0 ? (
              <div className="col-12 col-md-6">
                <h3 className="h6 mb-2">Injuries by body part</h3>
                <div className="table-responsive mb-3">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Body part</th>
                        <th className="text-end">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents?.injuriesByBodyPart.map((row) => (
                        <tr key={row.bodyPart}>
                          <td>{row.bodyPart}</td>
                          <td className="text-end">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <TrendTable title="Incident trend" points={incidents?.incidentTrend ?? []} />
            {(incidents?.recent?.length ?? 0) > 0 ? (
              <div className="col-12">
                <h3 className="h6 mb-2">Recent in range</h3>
                <ul className="list-unstyled mb-0">
                  {incidents?.recent.map((link) => (
                    <li key={link.id} className="mb-1">
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {panel === "overview" ? (
          <div className="row g-3">
            <NamedCountTable
              title="Incidents by category"
              rows={overview?.incidentsByCategory ?? []}
              keyHeader="Category"
            />
            <NamedCountTable
              title="Inspections by site"
              rows={overview?.inspectionsBySite ?? []}
              keyHeader="Site"
            />
            <TrendTable title="Incident trend" points={overview?.incidentTrend ?? []} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
