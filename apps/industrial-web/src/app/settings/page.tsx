"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, apiGet, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { useTenantBranding } from "@/hooks/use-tenant-branding";

type SiteRow = { id: string; name?: string; title?: string; status?: string };

type AdminSection =
  | "company"
  | "people"
  | "access"
  | "modules"
  | "notifications"
  | "data"
  | "advanced";

const SECTIONS: Array<{ id: AdminSection; label: string }> = [
  { id: "company", label: "Company" },
  { id: "people", label: "People" },
  { id: "access", label: "Access" },
  { id: "modules", label: "Modules" },
  { id: "notifications", label: "Notifications" },
  { id: "data", label: "Data" },
  { id: "advanced", label: "Advanced" },
];

/**
 * Business-facing Admin / Settings — hide Cognito/S3/UUID plumbing.
 */
export default function IndustrialSettingsPage() {
  const { me } = useAuth();
  const branding = useTenantBranding();
  const [section, setSection] = useState<AdminSection>("company");
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [moduleCount, setModuleCount] = useState<{ enabled: number; total: number } | null>(null);

  const companyName =
    me?.tenants.find((t) => t.tenantId === me.tenantId)?.displayName ?? "Your company";

  useEffect(() => {
    if (!me?.tenantId) {
      setSitesLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setSitesLoading(true);
      try {
        const [sitesData, boot] = await Promise.all([
          apiGet<{ items: SiteRow[] }>("/api/v1/industrial/sites", {
            query: { page: "1", pageSize: "50" },
          }),
          apiGet<{
            industrialEnabled: boolean;
            modules: Array<{ code: string; awsEnabled: boolean }>;
          }>("/api/v1/industrial/bootstrap").catch(() => null),
        ]);
        if (!cancelled) {
          setSites(sitesData.items ?? []);
          setSitesError(null);
          if (boot?.modules) {
            setModuleCount({
              total: boot.modules.length,
              enabled: boot.modules.filter((m) => m.awsEnabled).length,
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setSites([]);
          setSitesError(e instanceof ApiError ? e.message : "Unable to load locations");
        }
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.tenantId]);

  return (
    <div className="ind-content ind-admin">
      <PageHeader
        title="Administration"
        description={`Settings for ${companyName}`}
      />

      <div className="btn-group mb-4 flex-wrap" role="tablist" aria-label="Admin sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            className={`btn btn-sm ${section === s.id ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "company" ? (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h5 className="card-title mb-0">Company profile</h5>
              </div>
              <div className="card-body">
                <dl className="row mb-0 small">
                  <dt className="col-sm-4 text-muted">Company</dt>
                  <dd className="col-sm-8">{companyName}</dd>
                  <dt className="col-sm-4 text-muted">Product</dt>
                  <dd className="col-sm-8">{branding.productDisplayName}</dd>
                  <dt className="col-sm-4 text-muted">App label</dt>
                  <dd className="col-sm-8">{branding.appShortName}</dd>
                </dl>
              </div>
            </div>
          </div>
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
                    <p className="text-muted small mb-0">
                      Published branding is read-only here. Edit and publish from Creator Console →
                      Branding Studio.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Locations</h5>
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
                    title="No locations yet"
                    description="Add sites so the location selector and module filters have somewhere to point."
                  />
                ) : null}
                {sites.length > 0 ? (
                  <ul className="list-group list-group-flush">
                    {sites.map((s) => (
                      <li
                        key={s.id}
                        className="list-group-item d-flex justify-content-between align-items-center px-0"
                      >
                        <span>{s.name || s.title || "Location"}</span>
                        <span className="badge bg-label-secondary">{s.status || "ACTIVE"}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {section === "people" ? (
        <PageSection
          title="People"
          description="Manage employees and training from the People modules."
        >
          <div className="d-flex flex-wrap gap-2">
            <Link className="btn btn-sm btn-primary" href="/modules/personnel">
              Open Personnel
            </Link>
            <Link className="btn btn-sm btn-outline-primary" href="/modules/training">
              Open Training
            </Link>
          </div>
        </PageSection>
      ) : null}

      {section === "access" ? (
        <PageSection
          title="Access"
          description="Who can sign in and what they can do is managed by your Forge administrators."
        >
          <p className="text-muted small mb-2">
            Role and permission changes are not edited from Industrial Settings. Contact your
            platform administrator for access requests.
          </p>
          <span className="badge bg-label-secondary">Managed outside this app</span>
        </PageSection>
      ) : null}

      {section === "modules" ? (
        <PageSection
          title="Modules"
          description="Safety and operations modules enabled for this company."
        >
          {moduleCount ? (
            <p className="mb-3">
              <strong>{moduleCount.enabled}</strong> of {moduleCount.total} modules enabled
            </p>
          ) : (
            <p className="text-muted">Loading module status…</p>
          )}
          <Link className="btn btn-sm btn-outline-primary" href="/">
            View dashboard
          </Link>
          <p className="text-muted small mt-3 mb-0">
            Enabling or disabling modules is done by your Forge administrator — not from this
            screen.
          </p>
        </PageSection>
      ) : null}

      {section === "notifications" ? (
        <PageSection
          title="Notifications"
          description="Alerts for incidents, training, and reviews."
        >
          <p className="text-muted small mb-2">
            Tenant notification preferences will connect to shared Forge notification templates in
            a later wave.
          </p>
          <span className="badge bg-label-secondary">Coming in a later wave</span>
        </PageSection>
      ) : null}

      {section === "data" ? (
        <PageSection title="Data" description="Exports and operational reporting.">
          <p className="text-muted small mb-3">
            Operational reports and exports live in the Reporting module.
          </p>
          <Link className="btn btn-sm btn-outline-primary" href="/modules/reporting">
            Open Reporting
          </Link>
        </PageSection>
      ) : null}

      {section === "advanced" ? (
        <PageSection
          title="Advanced"
          description="Technical diagnostics stay out of day-to-day admin."
        >
          <p className="text-muted small mb-0">
            Integration keys, storage configuration, and identity provider settings are managed by
            Forge platform operators — not exposed here.
          </p>
        </PageSection>
      ) : null}
    </div>
  );
}
