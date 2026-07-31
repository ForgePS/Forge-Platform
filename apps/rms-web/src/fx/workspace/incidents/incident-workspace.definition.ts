import { getWorkspace, registerWorkspace } from "../FxWorkspaceRegistry";
import { RMS_FX_WORKSPACE_FLAG } from "../workspace-flags";
import type { WorkspaceDefinition } from "../types";

const StubLayout: WorkspaceDefinition["Layout"] = () => null;

export const INCIDENT_WORKSPACE_ID = "rms-incident";

/**
 * Registers the Incident workspace metadata.
 * Runtime chrome is composed by `IncidentFxWorkspaceLayout` in the incident route
 * so `?section=` deep links and domain panels stay authoritative.
 */
export function registerIncidentWorkspace(): void {
  if (getWorkspace(INCIDENT_WORKSPACE_ID)) return;
  registerWorkspace({
    id: INCIDENT_WORKSPACE_ID,
    recordType: "incident",
    title: "Incident workspace",
    description: "FX presentation chrome for existing RMS incident records.",
    icon: "incident",
    featureFlag: RMS_FX_WORKSPACE_FLAG,
    supportedTabs: [
      { id: "OVERVIEW", label: "Overview" },
      { id: "NARRATIVE", label: "Narrative" },
      { id: "ATTACHMENTS", label: "Attachments" },
      { id: "REVIEW", label: "Review" },
    ],
    Layout: StubLayout,
  });
}
