"use client";

import { DashboardPage } from "@/fx/dashboard/DashboardPage";
import { LegacyHomeDashboard } from "@/fx/dashboard/LegacyHomeDashboard";
import { useRmsFxDashboardFlag } from "@/fx/dashboard/use-dashboard-flag";

export default function HomePage() {
  const { enabled, loading } = useRmsFxDashboardFlag();

  if (loading) {
    return <p data-testid="rms-dashboard-flag-loading">Loading…</p>;
  }

  if (enabled) {
    return <DashboardPage />;
  }

  return <LegacyHomeDashboard />;
}
