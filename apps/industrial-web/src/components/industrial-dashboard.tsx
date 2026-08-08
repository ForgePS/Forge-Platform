"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INDUSTRIAL_MODULE_REGISTRY, INDUSTRIAL_PRODUCT_CODE } from "@forge/contracts";
import { apiGet, useAuth } from "@forge/web-kit";
import { buildIndustrialNavigation, featureFlagForModule } from "@/lib/navigation";
import { useTenantBranding } from "@/hooks/use-tenant-branding";

type Bootstrap = {
  industrialEnabled: boolean;
  modules: Array<{ code: string; awsEnabled: boolean; featureFlagKey?: string }>;
};

function launcherIcon(code: string): string {
  const c = code.toLowerCase();
  if (c.includes("personnel")) return "bx-group";
  if (c.includes("incident")) return "bx-error";
  if (c.includes("train")) return "bx-book";
  if (c.includes("jsa")) return "bx-list-check";
  if (c.includes("inspect")) return "bx-check-shield";
  if (c.includes("form")) return "bx-edit";
  if (c.includes("observ")) return "bx-show";
  if (c.includes("osha") || c.includes("workers") || c.includes("dot")) return "bx-file";
  if (c.includes("risk") || c.includes("scan")) return "bx-search-alt";
  if (c.includes("analytic")) return "bx-bar-chart-alt-2";
  return "bx-cube";
}

/**
 * Tenant-facing Industrial dashboard pattern (S3).
 * Uses the same bootstrap flags as IndustrialShell so launcher and sidebar agree.
 */
export function IndustrialDashboard() {
  const { me, hasPermission } = useAuth();
  const { productDisplayName } = useTenantBranding();
  const entitled = Boolean(me?.activeProducts?.includes(INDUSTRIAL_PRODUCT_CODE));
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.tenantId || !entitled) {
      setFlags({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const boot = await apiGet<Bootstrap>("/api/v1/industrial/bootstrap");
        if (cancelled) return;
        const next: Record<string, boolean> = {
          "industrial.enabled": Boolean(boot.industrialEnabled),
        };
        for (const m of boot.modules) {
          const key = m.featureFlagKey ?? featureFlagForModule(m.code);
          next[key] = Boolean(m.awsEnabled);
        }
        setFlags(next);
        setBootError(null);
      } catch (e) {
        if (!cancelled) {
          setFlags({});
          setBootError(e instanceof Error ? e.message : "Failed to load industrial bootstrap");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.tenantId, me?.userId, entitled]);

  const nav = buildIndustrialNavigation({
    entitled,
    permissions: me?.isPlatformAdmin
      ? ["industrial.access", ...(me?.permissions ?? [])]
      : (me?.permissions ?? []),
    flags,
  });

  const available = nav.filter((n) => n.available && n.code !== "CORE");
  const featured = nav.filter((n) => n.code !== "CORE").slice(0, 12);
  const coreReady = Boolean(flags["industrial.enabled"]);

  return (
    <div className="ind-dashboard">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">Industrial dashboard</h4>
          <p className="text-muted mb-0">
            {me?.tenantId
              ? coreReady
                ? "Industrial Core is live on AWS. Module workspaces unlock when their tenant feature flags are enabled."
                : "Authorized modules for your tenant. Availability reflects entitlement, permissions, and feature flags."
              : "Sign in and select a tenant to see authorized modules."}
          </p>
          {bootError ? <p className="text-danger small mb-0 mt-2">{bootError}</p> : null}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link className="btn btn-primary" href="/modules/personnel">
            <i className="bx bx-group me-1" aria-hidden="true" />
            Personnel
          </Link>
          <Link className="btn btn-outline-primary" href="/modules/incidents">
            <i className="bx bx-error me-1" aria-hidden="true" />
            Incidents
          </Link>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="fw-semibold d-block mb-1">Product</span>
                  <h5 className="card-title mb-1 text-heading">{productDisplayName}</h5>
                  <small className="text-muted">
                    {entitled ? "Entitled on this tenant" : "Not entitled on this tenant"}
                  </small>
                </div>
                <span className="avatar">
                  <span className="avatar-initial rounded bg-label-primary">
                    <i className="bx bx-buildings bx-sm" aria-hidden="true" />
                  </span>
                </span>
              </div>
              <div className="mt-3">
                <span className={`badge ${entitled ? "bg-label-success" : "bg-label-secondary"}`}>
                  {entitled ? "Entitled" : "Not entitled"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="fw-semibold d-block mb-1">Access</span>
                  <h5 className="card-title mb-1 text-heading">
                    {hasPermission("industrial.access") ? "industrial.access" : "Restricted"}
                  </h5>
                  <small className="text-muted">
                    {me?.isPlatformAdmin ? "Platform admin" : "Tenant membership"}
                  </small>
                </div>
                <span className="avatar">
                  <span className="avatar-initial rounded bg-label-info">
                    <i className="bx bx-shield-quarter bx-sm" aria-hidden="true" />
                  </span>
                </span>
              </div>
              <div className="mt-3">
                <span
                  className={`badge ${
                    hasPermission("industrial.access") ? "bg-label-primary" : "bg-label-secondary"
                  }`}
                >
                  {me?.isPlatformAdmin ? "Platform admin" : "Membership"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="fw-semibold d-block mb-1">Modules visible</span>
                  <h5 className="card-title mb-1 text-heading">{available.length || "—"}</h5>
                  <small className="text-muted">After permission and flag filters</small>
                </div>
                <span className="avatar">
                  <span className="avatar-initial rounded bg-label-warning">
                    <i className="bx bx-grid-alt bx-sm" aria-hidden="true" />
                  </span>
                </span>
              </div>
              <div className="mt-3">
                <span className="badge bg-label-warning">{featured.length} featured</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {available.length === 0 && entitled && coreReady ? (
        <div className="alert alert-primary mb-4" role="status">
          <div className="d-flex align-items-start gap-2">
            <i className="bx bx-info-circle bx-sm mt-1" aria-hidden="true" />
            <div>
              <strong>Thin slice:</strong> Shell and Core bootstrap are live. Operations modules
              unlock when their tenant feature flags are enabled.
            </div>
          </div>
        </div>
      ) : null}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0">Module launcher</h5>
        <span className="text-muted small">{featured.length} modules</span>
      </div>
      <div className="row g-4">
        {featured.map((mod) => {
          const { code, name, route, migrationStatus, available: availableFlag } = mod;
          const icon = launcherIcon(code);
          const statusLabel = availableFlag
            ? migrationStatus
            : mod.awsEnabled
              ? `Unavailable · ${migrationStatus}`
              : "Unavailable · flag off";

          return (
            <div className="col-sm-6 col-lg-4 col-xl-3" key={code}>
              {availableFlag ? (
                <Link href={route} className="card h-100 text-decoration-none ind-launcher-card">
                  <div className="card-body">
                    <div className="d-flex align-items-start gap-3">
                      <span className="avatar">
                        <span className="avatar-initial rounded bg-label-primary">
                          <i className={`bx ${icon} bx-sm`} aria-hidden="true" />
                        </span>
                      </span>
                      <div className="flex-grow-1 min-w-0">
                        <h6 className="mb-1 text-heading">{name}</h6>
                        <p className="small text-muted mb-2 text-truncate">{statusLabel}</p>
                        <span className="btn btn-sm btn-outline-primary">Open</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="card h-100 ind-launcher-card ind-launcher-card--disabled">
                  <div className="card-body">
                    <div className="d-flex align-items-start gap-3">
                      <span className="avatar">
                        <span className="avatar-initial rounded bg-label-secondary">
                          <i className={`bx ${icon} bx-sm`} aria-hidden="true" />
                        </span>
                      </span>
                      <div className="flex-grow-1 min-w-0">
                        <h6 className="mb-1 text-heading">{name}</h6>
                        <p className="small text-muted mb-2">{statusLabel}</p>
                        <span className="btn btn-sm btn-outline-secondary disabled" aria-disabled="true">
                          Locked
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {featured.length === 0
          ? INDUSTRIAL_MODULE_REGISTRY.filter((m) => m.code !== "CORE")
              .slice(0, 8)
              .map((mod) => (
                <div className="col-sm-6 col-lg-4 col-xl-3" key={mod.code}>
                  <div className="card h-100 ind-launcher-card ind-launcher-card--disabled">
                    <div className="card-body">
                      <h6 className="mb-1">{mod.name}</h6>
                      <p className="small text-muted mb-0">Unavailable · {mod.migrationStatus}</p>
                    </div>
                  </div>
                </div>
              ))
          : null}
      </div>
    </div>
  );
}
