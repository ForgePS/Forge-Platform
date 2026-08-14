"use client";

import { IndustrialDashboard } from "@/components/industrial-dashboard";

/**
 * Dedicated Analytics route — same live panels as the dashboard Analytics section.
 * Keeps Reporting nav honest (no “coming soon” while data already works on home).
 */
export function AnalyticsWorkspace({ moduleName }: { moduleName: string }) {
  return (
    <div data-module={moduleName}>
      <IndustrialDashboard />
    </div>
  );
}
