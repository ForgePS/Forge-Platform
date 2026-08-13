"use client";

import Link from "next/link";
import { INDUSTRIAL_PRODUCT_CODE, industrialAvailabilityLabel } from "@forge/contracts";
import { useAuth } from "@forge/web-kit";
import { buildIndustrialNavigation, moduleAvailabilityCaption } from "@/lib/navigation";

/**
 * Tenant-facing Industrial dashboard.
 * Shows only modules that are AWS-ready, customer-enabled, and permitted.
 */
export function IndustrialDashboard() {
  const { me, hasPermission } = useAuth();
  const entitled =
    Boolean(me?.isPlatformAdmin) || Boolean(me?.activeProducts?.includes(INDUSTRIAL_PRODUCT_CODE));
  const nav = buildIndustrialNavigation({
    entitled,
    permissions: me?.isPlatformAdmin
      ? ["industrial.access", ...(me?.permissions ?? [])]
      : (me?.permissions ?? []),
    flags: {},
    enabledModules: me?.activeModules ?? [],
    strictEntitlements: true,
  });

  const available = nav.filter((n) => n.available && n.code !== "CORE");

  return (
    <div className="ind-content ind-dashboard">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div className="min-w-0 flex-grow-1">
          <h1 className="mb-1">Industrial dashboard</h1>
          <p className="text-muted mb-0">
            {me?.tenantId
              ? "Modules enabled for this customer. Manage access in Creator Console → Products & Modules."
              : "Sign in and select a customer to see authorized modules."}
          </p>
        </div>
        <div className="ind-dashboard-actions">
          {available.some((m) => m.code === "PERSONNEL") ? (
            <Link className="btn btn-outline-primary" href="/modules/personnel">
              Personnel
            </Link>
          ) : null}
          {available.some((m) => m.code === "INCIDENTS") ? (
            <Link className="btn btn-outline-primary" href="/modules/incidents">
              Incidents
            </Link>
          ) : null}
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
                {entitled ? "Entitled" : "Not entitled for this customer"}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase small">Access</div>
              <div className="fw-semibold">
                {hasPermission("industrial.access") || me?.isPlatformAdmin
                  ? "Authorized"
                  : "Restricted"}
              </div>
              <div className="small text-muted mt-1">
                {me?.isPlatformAdmin ? "Platform admin" : "Customer membership"}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase small">Modules enabled</div>
              <div className="fw-semibold">{available.length || "—"}</div>
              <div className="small text-muted mt-1">Ready modules with customer access</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="h5 mb-3">Module launcher</h2>
      {available.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <p className="mb-2">No modules are enabled for this customer yet.</p>
            <p className="text-muted small mb-0">
              A platform administrator can enable Ready modules in Creator Console under the customer&apos;s
              Products &amp; Modules screen.
            </p>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {available.slice(0, 24).map((mod) => (
            <div className="col-12 col-sm-6 col-lg-4 col-xl-3" key={mod.code}>
              <Link href={mod.route} className="card h-100 text-decoration-none">
                <div className="card-body">
                  <h3 className="h6 mb-1 text-body">{mod.name}</h3>
                  <p className="small text-muted mb-0">
                    {moduleAvailabilityCaption(mod)} · {industrialAvailabilityLabel(mod.implementationStatus)}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
