"use client";

import Link from "next/link";

export function TenantIdentity({
  tenantId,
  loading,
}: {
  tenantId?: string | undefined;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rms-fx-tenant-identity" data-testid="rms-fx-tenant-identity">
        <span className="rms-fx-muted">Resolving tenant…</span>
      </div>
    );
  }
  if (!tenantId) {
    return (
      <div className="rms-fx-tenant-identity" data-testid="rms-fx-tenant-identity">
        <span className="rms-fx-muted">No tenant selected</span>
        <Link href="/select-tenant/" className="rms-fx-link">
          Select tenant
        </Link>
      </div>
    );
  }
  return (
    <div className="rms-fx-tenant-identity" data-testid="rms-fx-tenant-identity">
      <span className="rms-fx-label">Tenant</span>
      <span className="rms-fx-mono" title={tenantId}>
        {tenantId.slice(0, 8)}…
      </span>
      <Link href="/select-tenant/" className="rms-fx-link">
        Switch tenant
      </Link>
    </div>
  );
}
