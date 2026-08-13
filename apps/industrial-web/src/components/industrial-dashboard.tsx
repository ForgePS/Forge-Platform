"use client";

import Link from "next/link";
import { INDUSTRIAL_MODULE_REGISTRY, INDUSTRIAL_PRODUCT_CODE } from "@forge/contracts";
import { useAuth } from "@forge/web-kit";
import { buildIndustrialNavigation } from "@/lib/navigation";

/**
 * Tenant-facing Industrial dashboard pattern (S3).
 * Uses Sneat Bootstrap cards on the Industrial shell while sharing navigation
 * rules from INDUSTRIAL_MODULE_REGISTRY (same config Industrial sidebar uses).
 */
export function IndustrialDashboard() {
  const { me, hasPermission } = useAuth();
  const entitled = Boolean(me?.isPlatformAdmin) || Boolean(me?.activeProducts?.includes(INDUSTRIAL_PRODUCT_CODE));
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
  const featured = available.length > 0 ? available.slice(0, 12) : INDUSTRIAL_MODULE_REGISTRY.filter((m) => m.code !== "CORE").slice(0, 12);

  return (
    <div className="ind-content ind-dashboard">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div className="min-w-0 flex-grow-1">
          <h1 className="mb-1">Industrial dashboard</h1>
          <p className="text-muted mb-0">
            {me?.tenantId
              ? "Authorized modules for your tenant. Availability reflects entitlement, permissions, and feature flags."
              : "Sign in and select a tenant to see authorized modules."}
          </p>
        </div>
        <div className="ind-dashboard-actions">
          <Link className="btn btn-outline-primary" href="/modules/personnel">
            Personnel
          </Link>
          <Link className="btn btn-outline-primary" href="/modules/incidents">
            Incidents
          </Link>
          <Link className="btn btn-outline-secondary" href="/settings">
            Settings
          </Link>
        </div>
      </div>

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
      <div className="row g-3">
        {featured.map((mod) => {
          const code = "code" in mod ? mod.code : (mod as { code: string }).code;
          const name = "name" in mod ? mod.name : code;
          const route = "route" in mod ? mod.route : `/modules/${String(code).toLowerCase()}`;
          const meta =
            "migrationStatus" in mod
              ? String((mod as { migrationStatus: string }).migrationStatus)
              : "FOUNDATION";
          const availableFlag = "available" in mod ? Boolean((mod as { available?: boolean }).available) : true;
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
    </div>
  );
}
