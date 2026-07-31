"use client";

import { DashboardEmptyState } from "../DashboardStates";
import type { DashboardWidgetComponentProps } from "../types";

/** Honest empty state — no fabricated notification counts or delivery claims. */
export function NotificationsWidget(_props: DashboardWidgetComponentProps) {
  return (
    <DashboardEmptyState
      title="Notifications unavailable"
      description="An in-app notification feed is not connected for Forge RMS yet. This widget does not invent counts or claim email/SMS delivery."
    />
  );
}
