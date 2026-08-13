"use client";

import Link from "next/link";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";

const FLEET_REQUIRED_FIELDS = [
  "Year",
  "Make",
  "Model",
  "Color",
  "VIN",
  "License",
  "Renewal",
  "Location",
  "Assigned Driver",
  "County",
  "Insurance",
  "Mileage",
  "Notes",
  "Fringe",
] as const;

export function FleetBackendGap({ moduleName = "Fleet" }: { moduleName?: string }) {
  return (
    <div className="ind-ops">
      <PageHeader
        title="Fleet"
        description={
          moduleName !== "Fleet"
            ? `${moduleName}: vehicle and fleet records for this tenant.`
            : "Vehicle and fleet records for this tenant."
        }
      />

      <div className="alert alert-warning" role="status">
        Fleet persistence API is not available in this environment (BACKEND_GAP).
      </div>

      <PageSection
        title="Planned record fields"
        description="Documentation only — these fields are not writable here until the Fleet API is enabled."
      >
        <ul className="mb-0">
          {FLEET_REQUIRED_FIELDS.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      </PageSection>

      <EmptyState
        title="No fleet records in this environment"
        description="This screen does not substitute equipment data for fleet vehicles."
        action={
          <Link className="btn btn-outline-primary btn-sm" href="/modules/equipment">
            Open Equipment module
          </Link>
        }
      />
    </div>
  );
}
