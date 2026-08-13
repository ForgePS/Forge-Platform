"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, apiGet, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader } from "@/components/layout/page-chrome";
import { useTenantBranding } from "@/hooks/use-tenant-branding";

type SiteRow = { id: string; name?: string; title?: string; status?: string };

/**
 * Sneat MVP settings hub — branding preview + sites list + honest deferrals.
 */
export default function IndustrialSettingsPage() {
  const { me } = useAuth();
  const branding = useTenantBranding();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);

  useEffect(() => {
    if (!me?.tenantId) {
      setSitesLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setSitesLoading(true);
      try {
        const data = await apiGet<{ items: SiteRow[] }>("/api/v1/industrial/sites", {
          query: { page: "1", pageSize: "50" },
        });
        if (!cancelled) {
          setSites(data.items ?? []);
          setSitesError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setSites([]);
          setSitesError(e instanceof ApiError ? e.message : "Unable to load sites");
        }
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.tenantId]);

  const tenantLabel =
    me?.tenants.find((t) => t.tenantId === me.tenantId)?.displayName ?? me?.tenantId ?? "—";

  return (
    <div className="ind-content">
      <PageHeader
        title="Settings"
        description={`Tenant: ${tenantLabel}`}
      />

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">Branding</h5>
            </div>
            <div className="card-body">
              {branding.loading ? (
                <p className="text-muted mb-0">Loading published branding…</p>
              ) : (
                <>
                  <div
                    className="d-flex align-items-center gap-3 p-3 rounded mb-3"
                    style={{
                      background: branding.secondaryColor || "#14201a",
                      color: "#fff",
                      minHeight: "3.5rem",
                    }}
                  >
                    {branding.logoUrl ? (
                      <img
                        src={branding.logoUrl}
                        alt={branding.appShortName}
                        style={{ height: 36, maxWidth: 160, objectFit: "contain" }}
                      />
                    ) : (
                      <>
                        <span
                          aria-hidden
                          className="rounded"
                          style={{
                            width: 32,
                            height: 32,
                            background: branding.primaryColor || "#696cff",
                            display: "inline-block",
                          }}
                        />
                        <div>
                          <div className="fw-bold">{branding.appShortName}</div>
                          <div className="small opacity-75">{branding.productDisplayName}</div>
                        </div>
                      </>
                    )}
                  </div>
                  <dl className="row mb-3 small">
                    <dt className="col-sm-4 text-muted">Product</dt>
                    <dd className="col-sm-8">{branding.productDisplayName}</dd>
                    <dt className="col-sm-4 text-muted">Sidebar label</dt>
                    <dd className="col-sm-8">{branding.appShortName}</dd>
                    <dt className="col-sm-4 text-muted">Login label</dt>
                    <dd className="col-sm-8">{branding.loginShortName}</dd>
                  </dl>
                  <p className="text-muted small mb-0">
                    Published branding is read-only here. Edit and publish from Creator Console →
                    Branding Studio.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Sites &amp; locations</h5>
              {sitesLoading ? <span className="text-muted small">Loading…</span> : null}
            </div>
            <div className="card-body">
              {sitesError ? (
                <div className="alert alert-warning mb-3" role="alert">
                  {sitesError}
                </div>
              ) : null}
              {!sitesLoading && sites.length === 0 && !sitesError ? (
                <EmptyState
                  title="No sites yet"
                  description="Platform admins can seed sites via the industrial sites API; Equipment creation can also attach site IDs."
                />
              ) : null}
              {sites.length > 0 ? (
                <ul className="list-group list-group-flush">
                  {sites.map((s) => (
                    <li
                      key={s.id}
                      className="list-group-item d-flex justify-content-between align-items-center px-0"
                    >
                      <span>{s.name || s.title || s.id}</span>
                      <span className="badge bg-label-secondary">{s.status || "ACTIVE"}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Reports</h5>
              <p className="text-muted small">
                Operational reporting lives in the Reporting module.
              </p>
              <Link className="btn btn-outline-primary btn-sm" href="/modules/reporting">
                Open Reporting
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Notifications</h5>
              <p className="text-muted small mb-2">
                Tenant notification preferences will connect to shared Forge notification templates
                in a later wave.
              </p>
              <span className="badge bg-label-secondary">Coming in a later wave</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
