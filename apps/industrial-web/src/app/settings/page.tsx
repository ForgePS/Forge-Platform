"use client";

import Link from "next/link";

/**
 * Representative tenant Settings landing (S3 pattern).
 * No persistence — visual shell only until a settings API is available.
 */
export default function IndustrialSettingsPage() {
  return (
    <div className="ind-content">
      <h1>Settings</h1>
      <p className="text-muted">
        Tenant administration for Forge Industrial Safety. Product-specific configuration remains in
        module workspaces until shared settings APIs are ready.
      </p>
      <div className="row g-3">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h6">Organization</h2>
              <p className="small text-muted">Profile, locations, and sites.</p>
              <span className="badge bg-label-secondary">Not connected</span>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h6">Notifications</h2>
              <p className="small text-muted">Shared Forge notification preferences.</p>
              <span className="badge bg-label-secondary">Not connected</span>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h6">Reports</h2>
              <p className="small text-muted">
                Operational reporting landing — see <Link href="/modules/reporting">Reporting</Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="card mt-4">
        <div className="card-body">
          <h2 className="h6">No settings changes available</h2>
          <p className="mb-0 text-muted">
            This screen is a UI shell. Saving tenant settings requires a future API adapter.
          </p>
        </div>
      </div>
    </div>
  );
}
