import { RMS_FEATURE_FLAGS } from "@/lib/constants";
import { registerDashboardWidget } from "../DashboardRegistry";
import { CadConflictsWidget } from "./CadConflictsWidget";
import { CadStatusWidget } from "./CadStatusWidget";
import { MyWorkWidget } from "./MyWorkWidget";
import { NotificationsWidget } from "./NotificationsWidget";
import { QuickActionsWidget } from "./QuickActionsWidget";
import { RecentIncidentsWidget } from "./RecentIncidentsWidget";
import { ReviewQueueWidget } from "./ReviewQueueWidget";
import { SystemStatusWidget } from "./SystemStatusWidget";

let registered = false;

/** Test helper — allows re-registration after registry clear. */
export function resetDashboardWidgetsForTests(): void {
  registered = false;
}

/** Idempotent registration of live-data RMS widgets only. */
export function ensureDashboardWidgetsRegistered(): void {
  if (registered) return;
  registered = true;

  registerDashboardWidget({
    id: "quick-actions",
    title: "Quick actions",
    description: "Shortcuts to enabled RMS capabilities",
    category: "quick-actions",
    defaultSize: "2x1",
    minSize: "1x1",
    maxSize: "2x1",
    supportedBreakpoints: ["XS", "SM", "MD", "LG", "XL"],
    refreshable: false,
    defaultVisible: true,
    defaultOrder: 10,
    component: QuickActionsWidget,
  });

  registerDashboardWidget({
    id: "recent-incidents",
    title: "Recent incidents",
    description: "Latest incidents from the NERIS list API",
    category: "operational",
    featureFlag: RMS_FEATURE_FLAGS.incidentShell,
    permission: "rms.neris.incident.view",
    defaultSize: "2x2",
    minSize: "2x1",
    maxSize: "4x2",
    supportedBreakpoints: ["XS", "SM", "MD", "LG", "XL"],
    refreshable: true,
    defaultVisible: true,
    defaultOrder: 20,
    component: RecentIncidentsWidget,
  });

  registerDashboardWidget({
    id: "review-queue",
    title: "Incident review queue",
    description: "Incidents in review statuses from the incidents API",
    category: "queues",
    featureFlag: RMS_FEATURE_FLAGS.officerReview,
    permission: "rms.neris.incident.review",
    defaultSize: "2x2",
    minSize: "2x1",
    maxSize: "4x2",
    supportedBreakpoints: ["XS", "SM", "MD", "LG", "XL"],
    refreshable: true,
    defaultVisible: true,
    defaultOrder: 30,
    component: ReviewQueueWidget,
  });

  registerDashboardWidget({
    id: "cad-status",
    title: "CAD status",
    description: "CAD operations summary pipeline counts",
    category: "status",
    featureFlag: RMS_FEATURE_FLAGS.cadOperations,
    defaultSize: "2x1",
    minSize: "1x1",
    maxSize: "2x2",
    supportedBreakpoints: ["XS", "SM", "MD", "LG", "XL"],
    refreshable: true,
    defaultVisible: true,
    defaultOrder: 40,
    component: CadStatusWidget,
  });

  registerDashboardWidget({
    id: "cad-conflicts",
    title: "CAD conflict queue",
    description: "Open CAD conflict count from operations summary",
    category: "queues",
    featureFlag: RMS_FEATURE_FLAGS.cadEnabled,
    defaultSize: "1x1",
    minSize: "1x1",
    maxSize: "2x1",
    supportedBreakpoints: ["XS", "SM", "MD", "LG", "XL"],
    refreshable: true,
    defaultVisible: true,
    defaultOrder: 50,
    component: CadConflictsWidget,
  });

  registerDashboardWidget({
    id: "my-work",
    title: "My Work",
    description: "Links to existing actionable queues",
    category: "activity",
    defaultSize: "2x1",
    minSize: "1x1",
    maxSize: "2x1",
    supportedBreakpoints: ["XS", "SM", "MD", "LG", "XL"],
    refreshable: false,
    defaultVisible: true,
    defaultOrder: 60,
    component: MyWorkWidget,
  });

  registerDashboardWidget({
    id: "notifications",
    title: "Notifications",
    description: "Honest unavailable state until a feed exists",
    category: "notifications",
    defaultSize: "1x1",
    minSize: "1x1",
    maxSize: "2x1",
    supportedBreakpoints: ["XS", "SM", "MD", "LG", "XL"],
    refreshable: false,
    defaultVisible: true,
    defaultOrder: 70,
    component: NotificationsWidget,
  });

  registerDashboardWidget({
    id: "system-status",
    title: "System status",
    description: "Non-sensitive environment pointer and health link",
    category: "status",
    defaultSize: "1x1",
    minSize: "1x1",
    maxSize: "2x1",
    supportedBreakpoints: ["XS", "SM", "MD", "LG", "XL"],
    refreshable: false,
    defaultVisible: true,
    defaultOrder: 80,
    component: SystemStatusWidget,
  });
}
