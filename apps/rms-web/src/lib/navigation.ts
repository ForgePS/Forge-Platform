import type { ForgeNavigationGroup } from "@forge/design-system";
import { RMS_FEATURE_FLAGS } from "@/lib/constants";

/** Legacy-path navigation for ForgeAppShell (feature-flag filtered). */
export const RMS_LEGACY_NAV_GROUPS: ForgeNavigationGroup[] = [
  {
    id: "home",
    label: "Overview",
    items: [{ id: "home", label: "Home", route: "/" }],
  },
  {
    id: "records",
    label: "Records",
    items: [
      {
        id: "incidents",
        label: "Incidents",
        route: "/incidents/",
        featureFlag: RMS_FEATURE_FLAGS.incidentShell,
      },
      {
        id: "new-incident",
        label: "New Incident",
        route: "/incidents/new/",
        featureFlag: RMS_FEATURE_FLAGS.manualIntake,
      },
      {
        id: "review",
        label: "Review",
        route: "/review/",
        featureFlag: RMS_FEATURE_FLAGS.officerReview,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "cad-operations",
        label: "CAD Operations",
        route: "/cad/operations/",
        featureFlag: RMS_FEATURE_FLAGS.cadOperations,
      },
      {
        id: "cad-conflicts",
        label: "CAD Conflicts",
        route: "/cad/conflicts/",
        featureFlag: RMS_FEATURE_FLAGS.cadEnabled,
      },
      {
        id: "cad-messages",
        label: "CAD Messages",
        route: "/cad/messages/",
        featureFlag: RMS_FEATURE_FLAGS.cadOperations,
      },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    items: [
      {
        id: "neris-config",
        label: "NERIS Configuration",
        route: "/configuration/",
        featureFlag: RMS_FEATURE_FLAGS.tenantConfiguration,
      },
      {
        id: "cad-connections",
        label: "CAD Connections",
        route: "/cad/connections/",
        featureFlag: RMS_FEATURE_FLAGS.cadEnabled,
      },
      {
        id: "cad-unmapped",
        label: "CAD Unmapped",
        route: "/cad/unmapped/",
        featureFlag: RMS_FEATURE_FLAGS.cadEnabled,
      },
      {
        id: "cad-mappings",
        label: "CAD Unit / Personnel",
        route: "/cad/mappings/",
        featureFlag: RMS_FEATURE_FLAGS.cadEnabled,
      },
    ],
  },
];
