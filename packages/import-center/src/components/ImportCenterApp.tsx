"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ImportApi } from "../api.js";
import { clearImportTenantCache, setCachedJobs, getCachedJobs } from "../cache.js";
import { initiateProtectedDownload } from "../download.js";
import { dashboardStatusBuckets, serializeJobFilters, type ImportJobFilterState } from "../filters.js";
import { actionAllowed, disabledReason } from "../permissions.js";
import { formatImportError, sanitizeErrorMessage } from "../safe-error.js";
import {
  isExecutionActiveStatus,
  resolveImportWorkflowView,
  WORKFLOW_STEP_ORDER,
} from "../state-router.js";
import type {
  ImportJobSummary,
  ImportMappingRow,
  ImportRowError,
  ImportWorkflowView,
  MalwareVerdict,
} from "../types.js";
import {
  DuplicateConfidenceBadge,
  ImportEmptyState,
  ImportProgressBar,
  ImportStatusBadge,
  MalwareVerdictBadge,
  PrivilegedAccessBanner,
  ProductionScannerRestrictionBanner,
  SensitiveValue,
} from "./badges.js";

export type ImportCenterAppProps = {
  api: ImportApi;
  tenantId: string | null;
  hasPermission: (code: string) => boolean;
  /** Base path without trailing slash, e.g. `/imports` */
  basePath?: string;
  /** Optional Link component from next/link */
  LinkComponent?: (props: { href: string; children: ReactNode; className?: string }) => ReactNode;
  initialJobId?: string | null;
  initialView?: ImportWorkflowView | null;
  onNavigate?: (href: string) => void;
  /** Application environment — drives production scanner restriction banner */
  appEnv?: string | null;
};

const panel: CSSProperties = {
  border: "1px solid #d0d0d0",
  borderRadius: "0.35rem",
  padding: "1rem",
  marginBottom: "1rem",
  background: "#fff",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.9rem",
};

const thtd: CSSProperties = {
  borderBottom: "1px solid #e0e0e0",
  padding: "0.5rem",
  textAlign: "left",
  verticalAlign: "top",
};

function normalizeJobsPayload(data: unknown): ImportJobSummary[] {
  if (Array.isArray(data)) return data as ImportJobSummary[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: ImportJobSummary[] }).items;
  }
  return [];
}

function hashFragment(hash: string | null | undefined): string {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…`;
}

export function ImportCenterApp(props: ImportCenterAppProps) {
  const {
    api,
    tenantId,
    hasPermission,
    basePath = "/imports",
    initialJobId = null,
    initialView = null,
    onNavigate,
    appEnv = null,
  } = props;

  const [view, setView] = useState<ImportWorkflowView>(initialView ?? "dashboard");
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [job, setJob] = useState<ImportJobSummary | null>(null);
  const [filters, setFilters] = useState<ImportJobFilterState>({ page: 1, pageSize: 25 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ImportMappingRow[]>([]);
  const [errors, setErrors] = useState<ImportRowError[]>([]);
  const [statusPayload, setStatusPayload] = useState<Record<string, unknown> | null>(null);
  const [resultsPayload, setResultsPayload] = useState<Record<string, unknown> | null>(null);
  const [duplicates, setDuplicates] = useState<unknown[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [newForm, setNewForm] = useState({
    displayName: "",
    description: "",
    productKey: "",
    moduleKey: "",
    recordCategory: "",
    format: "csv" as "csv" | "xlsx" | "json",
  });
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canView = actionAllowed(hasPermission, "import.view");
  const privileged = actionAllowed(hasPermission, "import.sensitive");

  const navigate = useCallback(
    (nextView: ImportWorkflowView, nextJobId?: string | null) => {
      setView(nextView);
      if (nextJobId !== undefined) setJobId(nextJobId);
      const q = new URLSearchParams();
      if (nextJobId) q.set("jobId", nextJobId);
      if (nextView !== "dashboard") q.set("view", nextView);
      const href = `${basePath}/${q.toString() ? `?${q.toString()}` : ""}`;
      onNavigate?.(href);
    },
    [basePath, onNavigate],
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    clearImportTenantCache();
    setJobs([]);
    setJob(null);
    setMappings([]);
    setErrors([]);
    setStatusPayload(null);
    setResultsPayload(null);
    setDuplicates([]);
  }, [tenantId]);

  const reportError = useCallback((err: unknown) => {
    const formatted = formatImportError(err);
    setError(sanitizeErrorMessage(formatted.message));
    setCorrelationId(formatted.correlationId ?? null);
  }, []);

  const loadJobs = useCallback(async () => {
    if (!tenantId || !canView) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listJobs(serializeJobFilters(filters));
      const items = normalizeJobsPayload(data);
      setJobs(items);
      setCachedJobs(tenantId, items);
    } catch (err) {
      reportError(err);
      const cached = getCachedJobs(tenantId);
      if (Array.isArray(cached)) setJobs(cached as ImportJobSummary[]);
    } finally {
      setLoading(false);
    }
  }, [api, canView, filters, reportError, tenantId]);

  const loadJob = useCallback(
    async (id: string) => {
      if (!tenantId || !canView) return;
      setLoading(true);
      setError(null);
      try {
        const detail = await api.getJob(id);
        setJob(detail);
        const recommended = resolveImportWorkflowView(detail.status);
        if (!initialView) {
          setView(recommended);
        }
      } catch (err) {
        reportError(err);
        setJob(null);
      } finally {
        setLoading(false);
      }
    },
    [api, canView, initialView, reportError, tenantId],
  );

  useEffect(() => {
    if (view === "dashboard") void loadJobs();
  }, [view, loadJobs]);

  useEffect(() => {
    if (jobId && view !== "dashboard" && view !== "new") void loadJob(jobId);
  }, [jobId, view, loadJob]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!jobId || view !== "execution") return;
    const tick = async () => {
      try {
        const status = await api.getStatus(jobId);
        setStatusPayload(status);
        const st = String(status.status ?? "");
        if (!isExecutionActiveStatus(st)) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setView("results");
          void loadJob(jobId);
        }
      } catch {
        // transient — keep polling
      }
    };
    void tick();
    pollRef.current = setInterval(() => void tick(), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [api, jobId, loadJob, view]);

  const buckets = useMemo(
    () => dashboardStatusBuckets(jobs.map((j) => String(j.status))),
    [jobs],
  );

  if (!tenantId) {
    return <ImportEmptyState title="Select a tenant to open Import Center." />;
  }
  if (!canView) {
    return (
      <ImportEmptyState title="Import Center is unavailable.">
        <p>Requires permission import.view. Server authorization remains authoritative.</p>
      </ImportEmptyState>
    );
  }

  async function handleCreateAndUpload(file: File | null) {
    const blocked = disabledReason(hasPermission, "import.upload");
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setLoading(true);
    setError(null);
    setUploadProgress(0);
    try {
      const init = (await api.initializeUpload({
        productKey: newForm.productKey || "REFERENCE",
        moduleKey: newForm.moduleKey || "CORE",
        recordCategory: newForm.recordCategory || "generic_record",
        displayName: newForm.displayName || file.name,
        description: newForm.description || undefined,
        fileName: file.name,
        contentType: file.type || "text/csv",
        byteSize: file.size,
        format: newForm.format,
      })) as {
        job?: { id: string };
        jobId?: string;
        upload?: {
          mode?: string;
          uploadUrl?: string;
          multipartUploadId?: string;
          partSizeBytes?: number;
          partCount?: number;
          parts?: Array<{ uploadUrl: string; partNumber: number }>;
        };
      };
      const createdJobId = init.job?.id ?? init.jobId;
      if (!createdJobId) {
        throw new Error("Upload initialization did not return jobId.");
      }
      if (init.upload?.mode === "S3_PRESIGNED" && init.upload.uploadUrl) {
        await putWithProgress(init.upload.uploadUrl, file, setUploadProgress);
        await api.completeUpload(createdJobId, {});
      } else if (init.upload?.mode === "S3_MULTIPART" && init.upload.parts?.length) {
        const parts: Array<{ partNumber: number; etag: string }> = [];
        const partSize = init.upload.partSizeBytes ?? 5 * 1024 * 1024;
        for (const part of init.upload.parts) {
          const start = (part.partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const blob = file.slice(start, end);
          const etag = await putPart(part.uploadUrl, blob);
          parts.push({ partNumber: part.partNumber, etag });
          setUploadProgress(Math.round((end / file.size) * 100));
        }
        // Request remaining part URLs when initial batch is incomplete.
        let nextPart = (init.upload.parts.at(-1)?.partNumber ?? 0) + 1;
        const totalParts = init.upload.partCount ?? parts.length;
        while (nextPart <= totalParts) {
          const batch = (await api.getUploadParts(createdJobId, {
            partNumbers: Array.from(
              { length: Math.min(20, totalParts - nextPart + 1) },
              (_, i) => nextPart + i,
            ),
          })) as { parts?: Array<{ uploadUrl: string; partNumber: number }> };
          const more = batch?.parts ?? [];
          if (!more.length) break;
          for (const part of more) {
            const start = (part.partNumber - 1) * partSize;
            const end = Math.min(start + partSize, file.size);
            const etag = await putPart(part.uploadUrl, file.slice(start, end));
            parts.push({ partNumber: part.partNumber, etag });
            setUploadProgress(Math.round((end / file.size) * 100));
          }
          nextPart = (more.at(-1)?.partNumber ?? nextPart) + 1;
        }
        await api.completeUpload(createdJobId, { parts });
      } else {
        throw new Error("Upload initialization did not return a supported upload mode.");
      }
      setJobId(createdJobId);
      navigate("security", createdJobId);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }

  async function handleRescan(reason: string) {
    const blocked = disabledReason(hasPermission, "import.validate");
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!job?.id || !job.file?.id) return;
    if (!window.confirm("Request a malware rescan for this file?")) return;
    setLoading(true);
    try {
      await api.rescan(job.id, job.file.id, { reason });
      await loadJob(job.id);
      setView("security");
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMappings() {
    const blocked = disabledReason(hasPermission, "import.map");
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!jobId) return;
    setLoading(true);
    try {
      await api.putMappings(jobId, mappings.length ? mappings : [
        { sourceColumn: "col1", targetField: "field1", isRequired: true, ordinal: 0 },
      ]);
      await loadJob(jobId);
      setView("validation");
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    const blocked = disabledReason(hasPermission, "import.approve");
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!jobId) return;
    if (!window.confirm("Approve this import for execution?")) return;
    setLoading(true);
    try {
      await api.approve(jobId);
      await loadJob(jobId);
      setView("execute");
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    const blocked = disabledReason(hasPermission, "import.execute");
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!jobId) return;
    if (!window.confirm("Queue this import for execution? Row data is not sent from the browser.")) {
      return;
    }
    setLoading(true);
    try {
      await api.execute(jobId, {});
      setView("execution");
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(kind: "results" | "errors" | "security", privilegedReq = false) {
    if (!jobId) return;
    if (privilegedReq) {
      const blocked = disabledReason(hasPermission, "import.sensitive");
      if (blocked) {
        setError(blocked);
        return;
      }
      if (!window.confirm("Request a privileged download? Access is audited.")) return;
    }
    setLoading(true);
    try {
      const auth =
        kind === "results"
          ? await api.downloadResults(jobId, privilegedReq)
          : kind === "errors"
            ? await api.downloadErrors(jobId, privilegedReq)
            : await api.downloadSecurityReport(jobId);
      await initiateProtectedDownload({
        downloadUrl: auth.downloadUrl,
        expiresAt: auth.expiresAt,
        contentType: auth.contentType,
        fileName: `${kind}-${jobId}.json`,
      });
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRollback() {
    const blocked = disabledReason(hasPermission, "import.rollback");
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!jobId) return;
    if (
      !window.confirm(
        "Request rollback classification? Full compensation is not yet implemented; this submits a classification request only.",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      await api.requestRollback(jobId, {});
      await loadJob(jobId);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryError(errorId: string) {
    const blocked = disabledReason(hasPermission, "import.error.reprocess");
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!jobId) return;
    if (!window.confirm("Retry this eligible row error?")) return;
    setLoading(true);
    try {
      await api.retryError(jobId, errorId, {});
      const rows = await api.listErrors(jobId);
      setErrors(Array.isArray(rows) ? rows : []);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }

  const malwareVerdict = (job?.file?.malwareVerdict ?? "NOT_SUBMITTED") as MalwareVerdict;
  const quarantined =
    job?.status === "QUARANTINED" || job?.file?.quarantineStatus === "QUARANTINED";

  return (
    <div>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0 }}>Import Center</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#555" }}>
          Shared Universal Import Platform — product-neutral workflow. Server state is authoritative.
        </p>
      </header>

      <ProductionScannerRestrictionBanner appEnv={appEnv} />
      <PrivilegedAccessBanner visible={privileged && view !== "dashboard"} />

      <nav aria-label="Import Center sections" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        {(
          [
            ["dashboard", "Overview"],
            ["new", "New Import"],
            ["profiles", "Profiles"],
            ["templates", "Templates"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => navigate(v, v === "dashboard" || v === "new" ? null : jobId)}
            aria-current={view === v ? "page" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      {jobId && view !== "dashboard" && view !== "new" ? (
        <ol
          aria-label="Import workflow steps"
          style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", padding: 0 }}
        >
          {WORKFLOW_STEP_ORDER.filter((s) => s.view !== "new").map((step) => (
            <li key={step.view}>
              <button
                type="button"
                disabled={quarantined && !["security", "quarantine", "results"].includes(step.view)}
                onClick={() => navigate(step.view, jobId)}
                aria-current={view === step.view ? "step" : undefined}
              >
                {step.label}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {error ? (
        <div role="alert" style={{ ...panel, borderColor: "#a11" }}>
          <strong>Error</strong>
          <p>{error}</p>
          {correlationId ? <p>Correlation ID: {correlationId}</p> : null}
        </div>
      ) : null}

      {loading ? <p role="status">Loading…</p> : null}

      {view === "dashboard" ? (
        <section aria-labelledby="import-dashboard-heading">
          <h2 id="import-dashboard-heading">Overview</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(9rem,1fr))", gap: "0.75rem" }}>
            {Object.entries(buckets).map(([key, value]) => (
              <div key={key} style={panel}>
                <div style={{ fontSize: "0.8rem", color: "#555" }}>{key}</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={panel}>
            <label htmlFor="import-search">
              Search
              <input
                id="import-search"
                value={filters.search ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              />
            </label>
            <label htmlFor="import-status" style={{ display: "block", marginTop: "0.75rem" }}>
              Status
              <select
                id="import-status"
                value={filters.status ?? ""}
                onChange={(e) =>
                  setFilters((f) => { const next = { ...f, page: 1 }; if (e.target.value) next.status = e.target.value; else delete next.status; return next; })
                }
                style={{ display: "block", marginTop: "0.25rem" }}
              >
                <option value="">Any</option>
                {[
                  "READY_FOR_MAPPING",
                  "AWAITING_APPROVAL",
                  "PROCESSING",
                  "COMPLETED",
                  "FAILED",
                  "QUARANTINED",
                  "SCAN_FAILED",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" style={{ marginTop: "0.75rem" }} onClick={() => void loadJobs()}>
              Apply filters
            </button>
          </div>
          {jobs.length === 0 && !loading ? (
            <ImportEmptyState title="No import jobs for this tenant.">
              <button type="button" onClick={() => navigate("new", null)}>
                Start a new import
              </button>
            </ImportEmptyState>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {["Name", "File", "Record", "Status", "Malware", "Progress", "Updated", "Actions"].map(
                      (h) => (
                        <th key={h} style={thtd} scope="col">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((row) => (
                    <tr key={row.id}>
                      <td style={thtd}>{row.displayName}</td>
                      <td style={thtd}>{row.file?.fileName ?? "—"}</td>
                      <td style={thtd}>{row.recordCategory}</td>
                      <td style={thtd}>
                        <ImportStatusBadge status={String(row.status)} />
                      </td>
                      <td style={thtd}>
                        <MalwareVerdictBadge
                          verdict={(row.file?.malwareVerdict as string) ?? "NOT_SUBMITTED"}
                        />
                      </td>
                      <td style={thtd}>{row.progressPercent ?? 0}%</td>
                      <td style={thtd}>{new Date(row.updatedAt).toLocaleString()}</td>
                      <td style={thtd}>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(resolveImportWorkflowView(row.status), row.id)
                          }
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {view === "new" ? (
        <section aria-labelledby="new-import-heading" style={panel}>
          <h2 id="new-import-heading">New import</h2>
          <p>Options come from server configuration. Unavailable products stay disabled when APIs omit them.</p>
          {(
            [
              ["displayName", "Import name"],
              ["description", "Description"],
              ["productKey", "Product key"],
              ["moduleKey", "Module key"],
              ["recordCategory", "Record type"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} htmlFor={`new-${key}`} style={{ display: "block", marginBottom: "0.75rem" }}>
              {label}
              <input
                id={`new-${key}`}
                value={newForm[key]}
                onChange={(e) => setNewForm((f) => ({ ...f, [key]: e.target.value }))}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          ))}
          <label htmlFor="new-format" style={{ display: "block", marginBottom: "0.75rem" }}>
            Expected format
            <select
              id="new-format"
              value={newForm.format}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, format: e.target.value as "csv" | "xlsx" | "json" }))
              }
              style={{ display: "block" }}
            >
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label htmlFor="new-file" style={{ display: "block", marginBottom: "0.75rem" }}>
            File
            <input
              id="new-file"
              type="file"
              accept=".csv,.xlsx,.json,.zip,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
              onChange={(e) => void handleCreateAndUpload(e.target.files?.[0] ?? null)}
              disabled={Boolean(disabledReason(hasPermission, "import.upload"))}
              style={{ display: "block", marginTop: "0.35rem" }}
            />
          </label>
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            Drag-and-drop is available via the file picker. Large files are not parsed in the browser.
            Presigned URLs are never logged.
          </p>
          {uploadProgress != null ? (
            <ImportProgressBar percent={uploadProgress} label="Upload progress" />
          ) : null}
          {disabledReason(hasPermission, "import.upload") ? (
            <p role="status">{disabledReason(hasPermission, "import.upload")}</p>
          ) : null}
        </section>
      ) : null}

      {view === "security" && job ? (
        <section style={panel} aria-labelledby="security-heading">
          <h2 id="security-heading">Security scan</h2>
          <p>
            Verdict: <MalwareVerdictBadge verdict={malwareVerdict} />
          </p>
          <p>Job status: <ImportStatusBadge status={String(job.status)} /></p>
          <p>Hash: {hashFragment(job.file?.contentHash)}</p>
          <p>Scan attempts are managed by the server. No malware override control is available.</p>
          {job.status === "SCAN_FAILED" || malwareVerdict === "SCAN_TIMEOUT" || malwareVerdict === "SCAN_FAILED" ? (
            <div>
              <label htmlFor="rescan-reason">
                Rescan justification
                <textarea id="rescan-reason" rows={3} style={{ display: "block", width: "100%" }} />
              </label>
              <button
                type="button"
                style={{ marginTop: "0.5rem" }}
                disabled={Boolean(disabledReason(hasPermission, "import.validate"))}
                onClick={() => {
                  const el = document.getElementById("rescan-reason") as HTMLTextAreaElement | null;
                  void handleRescan(el?.value ?? "");
                }}
              >
                Request rescan
              </button>
            </div>
          ) : null}
          {malwareVerdict === "CLEAN" ? (
            <button type="button" onClick={() => navigate("mapping", job.id)}>
              Continue to mapping
            </button>
          ) : null}
        </section>
      ) : null}

      {view === "quarantine" && job ? (
        <section style={panel} aria-labelledby="quarantine-heading">
          <h2 id="quarantine-heading">Quarantine</h2>
          <ul>
            <li>Job ID: {job.id}</li>
            <li>File ID: {job.file?.id ?? "—"}</li>
            <li>Filename: {job.file?.fileName ?? "—"}</li>
            <li>Size: {job.file?.byteSize ?? "—"}</li>
            <li>Hash: {hashFragment(job.file?.contentHash)}</li>
            <li>
              Verdict: <MalwareVerdictBadge verdict={malwareVerdict} />
            </li>
            <li>Security hold: {job.securityHold || quarantined ? "yes" : "no"}</li>
          </ul>
          <p role="status">
            Mapping, validation, approval, execution, and normal downloads are blocked. Malware payload
            details are not shown. Quarantine release is unavailable in this sprint.
          </p>
          <button
            type="button"
            disabled={Boolean(disabledReason(hasPermission, "import.validate"))}
            onClick={() => void handleRescan("Quarantine investigation rescan")}
          >
            Request rescan
          </button>
        </section>
      ) : null}

      {view === "mapping" && job ? (
        <section style={panel} aria-labelledby="mapping-heading">
          <h2 id="mapping-heading">Mapping workspace</h2>
          {quarantined ? (
            <p role="alert">Quarantined files cannot be mapped.</p>
          ) : (
            <>
              <p>Destination fields and transformations must match the backend mapping contract.</p>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thtd}>Source</th>
                    <th style={thtd}>Destination</th>
                    <th style={thtd}>Required</th>
                    <th style={thtd}>Sensitive</th>
                  </tr>
                </thead>
                <tbody>
                  {(mappings.length
                    ? mappings
                    : [
                        {
                          sourceColumn: "",
                          targetField: "",
                          isRequired: false,
                          isSensitive: false,
                          ordinal: 0,
                        },
                      ]
                  ).map((row, index) => (
                    <tr key={index}>
                      <td style={thtd}>
                        <input
                          aria-label={`Source column ${index + 1}`}
                          value={row.sourceColumn}
                          onChange={(e) => {
                            const next = [...(mappings.length ? mappings : [row])];
                            next[index] = { ...next[index]!, sourceColumn: e.target.value };
                            setMappings(next);
                          }}
                        />
                      </td>
                      <td style={thtd}>
                        <input
                          aria-label={`Destination field ${index + 1}`}
                          value={row.targetField}
                          onChange={(e) => {
                            const next = [...(mappings.length ? mappings : [row])];
                            next[index] = { ...next[index]!, targetField: e.target.value };
                            setMappings(next);
                          }}
                        />
                      </td>
                      <td style={thtd}>{row.isRequired ? "Yes" : "No"}</td>
                      <td style={thtd}>
                        {row.isSensitive ? (
                          <SensitiveValue value="[MASKED]" sensitive />
                        ) : (
                          "No"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                onClick={() =>
                  setMappings((m) => [
                    ...m,
                    {
                      sourceColumn: "",
                      targetField: "",
                      isRequired: false,
                      ordinal: m.length,
                    },
                  ])
                }
              >
                Add mapping row
              </button>{" "}
              <button
                type="button"
                disabled={Boolean(disabledReason(hasPermission, "import.map"))}
                onClick={() => void handleSaveMappings()}
              >
                Save mappings
              </button>
              <button
                type="button"
                disabled={Boolean(disabledReason(hasPermission, "import.validate"))}
                onClick={() => {
                  if (!jobId) return;
                  void (async () => {
                    try {
                      await api.requestValidation(jobId);
                      setView("validation");
                    } catch (err) {
                      reportError(err);
                    }
                  })();
                }}
              >
                Request validation
              </button>
            </>
          )}
        </section>
      ) : null}

      {view === "validation" && job ? (
        <section style={panel}>
          <h2>Validation</h2>
          <p>Server validation is authoritative. Client checks are guidance only.</p>
          <button
            type="button"
            onClick={() => {
              if (!jobId) return;
              void (async () => {
                try {
                  const rows = await api.listErrors(jobId);
                  setErrors(Array.isArray(rows) ? rows : []);
                } catch (err) {
                  reportError(err);
                }
              })();
            }}
          >
            Refresh errors
          </button>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Code", "Field", "Message", "Severity"].map((h) => (
                  <th key={h} style={thtd}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {errors.map((err) => (
                <tr key={err.id}>
                  <td style={thtd}>{err.ruleCode}</td>
                  <td style={thtd}>{err.fieldPath ?? "—"}</td>
                  <td style={thtd}>{err.message}</td>
                  <td style={thtd}>{err.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => navigate("preview", jobId)}>
            Continue to preview
          </button>
        </section>
      ) : null}

      {view === "preview" && job ? (
        <section style={panel}>
          <h2>Preview</h2>
          <p>
            Preview values are policy-filtered by the server. Sensitive samples render as masked.
          </p>
          <button
            type="button"
            disabled={Boolean(disabledReason(hasPermission, "import.preview"))}
            onClick={() => {
              if (!jobId) return;
              void api.requestPreview(jobId).catch(reportError);
            }}
          >
            Request preview
          </button>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thtd}>Field</th>
                <th style={thtd}>Sample</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={thtd}>email</td>
                <td style={thtd}>
                  <SensitiveValue value="j***@example.com" sensitive privileged={privileged} />
                </td>
              </tr>
              <tr>
                <td style={thtd}>password</td>
                <td style={thtd}>
                  <SensitiveValue value="********" sensitive neverReturnable />
                </td>
              </tr>
            </tbody>
          </table>
          <button type="button" onClick={() => navigate("duplicates", jobId)}>
            Duplicate review
          </button>
        </section>
      ) : null}

      {view === "duplicates" && job ? (
        <section style={panel}>
          <h2>Duplicate review</h2>
          <p>No automatic merge action. Decisions are submitted to the server.</p>
          <button
            type="button"
            onClick={() => {
              if (!jobId) return;
              void (async () => {
                try {
                  const data = await api.listDuplicates({ jobId });
                  setDuplicates(Array.isArray(data) ? data : normalizeJobsPayload(data));
                } catch (err) {
                  reportError(err);
                }
              })();
            }}
          >
            Load candidates
          </button>
          <ul>
            {(duplicates as Array<{ id: string; confidence?: number; confidenceBand?: string }>).map(
              (d) => (
                <li key={d.id}>
                  {d.id.slice(0, 8)}…{" "}
                  <DuplicateConfidenceBadge
                    confidence={Number(d.confidence ?? 0)}
                    {...(d.confidenceBand ? { band: d.confidenceBand } : {})}
                  />
                </li>
              ),
            )}
          </ul>
          <button type="button" onClick={() => navigate("approval", jobId)}>
            Continue to approval
          </button>
        </section>
      ) : null}

      {view === "approval" && job ? (
        <section style={panel}>
          <h2>Approval</h2>
          <ul>
            <li>Job: {job.displayName}</li>
            <li>File: {job.file?.fileName}</li>
            <li>
              Malware: <MalwareVerdictBadge verdict={malwareVerdict} />
            </li>
            <li>Status: {job.status}</li>
          </ul>
          {quarantined ||
          (malwareVerdict !== "CLEAN" && malwareVerdict !== "OVERRIDE_APPROVED") ? (
            <p role="alert">Approval is blocked until malware verdict is acceptable.</p>
          ) : (
            <button
              type="button"
              disabled={Boolean(disabledReason(hasPermission, "import.approve"))}
              onClick={() => void handleApprove()}
            >
              Approve
            </button>
          )}
          {disabledReason(hasPermission, "import.approve") ? (
            <p role="status">{disabledReason(hasPermission, "import.approve")}</p>
          ) : null}
        </section>
      ) : null}

      {view === "execute" && job ? (
        <section style={panel}>
          <h2>Execute confirmation</h2>
          <p>
            Execution uses the backend control plane. The browser does not enqueue rows or send file
            contents.
          </p>
          <p>
            Current malware verdict: <MalwareVerdictBadge verdict={malwareVerdict} />
          </p>
          <button
            type="button"
            disabled={
              Boolean(disabledReason(hasPermission, "import.execute")) ||
              job.status !== "APPROVED"
            }
            onClick={() => void handleExecute()}
          >
            Queue execution
          </button>
        </section>
      ) : null}

      {view === "execution" && job ? (
        <section style={panel} aria-live="polite">
          <h2>Execution monitor</h2>
          <p>Status: {String(statusPayload?.status ?? job.status)}</p>
          <ImportProgressBar
            percent={Number(statusPayload?.progressPercent ?? job.progressPercent ?? 0)}
            label="Execution progress"
          />
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
            {JSON.stringify(statusPayload?.rowCounts ?? {}, null, 2)}
          </pre>
          <button
            type="button"
            disabled={Boolean(disabledReason(hasPermission, "import.execute"))}
            onClick={() => {
              if (!jobId) return;
              if (!window.confirm("Request cancellation? Completed rows may remain committed.")) return;
              void api.cancelExecution(jobId, {}).catch(reportError);
            }}
          >
            Request cancellation
          </button>
        </section>
      ) : null}

      {view === "results" && job ? (
        <section style={panel}>
          <h2>Results</h2>
          <p>
            Final status: <ImportStatusBadge status={String(job.status)} />
          </p>
          <button
            type="button"
            onClick={() => {
              if (!jobId) return;
              void (async () => {
                try {
                  setResultsPayload(await api.getResults(jobId));
                  setErrors(await api.listErrors(jobId));
                } catch (err) {
                  reportError(err);
                }
              })();
            }}
          >
            Refresh results
          </button>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
            {JSON.stringify(resultsPayload ?? {}, null, 2)}
          </pre>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button type="button" onClick={() => void handleDownload("results", false)}>
              Download masked results
            </button>
            <button type="button" onClick={() => void handleDownload("errors", false)}>
              Download masked errors
            </button>
            <button type="button" onClick={() => void handleDownload("security")}>
              Download security report
            </button>
            {privileged ? (
              <button type="button" onClick={() => void handleDownload("results", true)}>
                Privileged results
              </button>
            ) : null}
            <button
              type="button"
              disabled={Boolean(disabledReason(hasPermission, "import.rollback"))}
              onClick={() => void handleRollback()}
            >
              Request rollback
            </button>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            Rollback requests submit classification only. Full compensation is not implemented.
          </p>
          <h3>Errors</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Code", "Message", "Retry"].map((h) => (
                  <th key={h} style={thtd}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {errors.map((err) => (
                <tr key={err.id}>
                  <td style={thtd}>{err.ruleCode}</td>
                  <td style={thtd}>{err.message}</td>
                  <td style={thtd}>
                    <button
                      type="button"
                      disabled={Boolean(disabledReason(hasPermission, "import.error.reprocess"))}
                      onClick={() => void handleRetryError(err.id)}
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {view === "profiles" ? (
        <section style={panel}>
          <h2>Import profiles</h2>
          <p>
            Profile management requires import.profile.manage. Selection uses published profiles from
            the Import Platform API.
          </p>
          {!actionAllowed(hasPermission, "import.profile.manage") ? (
            <p role="status">Profile administration is hidden without import.profile.manage.</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void api.listProfiles().catch(reportError);
            }}
          >
            Load profiles
          </button>
        </section>
      ) : null}

      {view === "templates" ? (
        <section style={panel}>
          <h2>Templates</h2>
          {!actionAllowed(hasPermission, "import.template.manage") &&
          !actionAllowed(hasPermission, "import.view") ? (
            <p role="status">Templates require import.view.</p>
          ) : (
            <button type="button" onClick={() => void api.listTemplates().catch(reportError)}>
              Load templates
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

async function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(file);
  });
}

async function putPart(url: string, blob: Blob): Promise<string> {
  const res = await fetch(url, {
    method: "PUT",
    body: blob,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Part upload failed (${res.status})`);
  }
  const etag = res.headers.get("etag") ?? res.headers.get("ETag");
  if (!etag) {
    throw new Error("Part upload did not return ETag");
  }
  return etag.replaceAll('"', "");
}
