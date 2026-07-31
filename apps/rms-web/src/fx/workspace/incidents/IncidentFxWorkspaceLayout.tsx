"use client";

import type { ReactNode } from "react";
import { AutosaveIndicator } from "@/hooks/use-autosave";
import type { SpecialtyWorkflowGroup } from "@/lib/rms-api";
import { sectionLabel } from "@/components/incident-workspace";
import { FxWorkspaceLayout } from "../FxWorkspaceLayout";
import type { WorkspaceTabDefinition } from "../types";
import {
  adaptIncidentRelated,
  adaptIncidentSummary,
  adaptIncidentTimeline,
} from "./incident-adapters";
import type { IncidentDetail } from "@/lib/rms-api";
import styles from "@/app/page.module.css";

function tabLabel(section: string, specialtyWorkflows: SpecialtyWorkflowGroup[]): string {
  const specialty = specialtyWorkflows.find((g) => g.sectionKey === section);
  const suffix =
    specialty?.state === "NOT_APPLICABLE"
      ? " (N/A)"
      : specialty?.hasBlockingGaps
        ? " (!)"
        : specialty?.completionPercent != null && specialty.fieldCount
          ? ` (${specialty.completionPercent}%)`
          : "";
  return `${sectionLabel(section)}${suffix}`;
}

/**
 * FX chrome for the Incident workspace. Domain section bodies remain unchanged.
 * Deep links continue to use `?section=` as the source of truth.
 */
export function IncidentFxWorkspaceLayout({
  incident,
  activeSection,
  sections,
  specialtyWorkflows = [],
  autosaveStatus,
  autosaveError,
  onRetryAutosave,
  saveAndExit,
  onTabChange,
  children,
}: {
  incident: IncidentDetail;
  activeSection: string;
  sections: string[];
  specialtyWorkflows?: SpecialtyWorkflowGroup[];
  autosaveStatus: Parameters<typeof AutosaveIndicator>[0]["status"];
  autosaveError: string | null;
  onRetryAutosave?: () => void;
  saveAndExit?: ReactNode;
  onTabChange: (sectionKey: string) => void;
  children: ReactNode;
}) {
  const navSections =
    sections.length > 0
      ? sections
      : [
          "OVERVIEW",
          "DISPATCH",
          "LOCATION",
          "UNITS_PERSONNEL",
          "CLASSIFICATION",
          "NARRATIVE",
          "REVIEW",
        ];

  const tabs: WorkspaceTabDefinition[] = navSections.map((id) => ({
    id,
    label: tabLabel(id, specialtyWorkflows),
  }));

  const summary = adaptIncidentSummary(incident);
  const timeline = adaptIncidentTimeline(incident);
  const related = adaptIncidentRelated(incident.id, navSections);

  return (
    <div className={styles.page}>
      <FxWorkspaceLayout
        recordId={incident.id}
        title={incident.incidentNumber}
        status={incident.status}
        recordTypeLabel="Incident"
        ownerLabel={incident.reportOwnerUserId ?? null}
        createdAt={incident.createdAt}
        updatedAt={incident.updatedAt}
        activeTab={activeSection}
        tabs={tabs}
        onTabChange={onTabChange}
        breadcrumbItems={[
          { label: "Incidents", href: "/incidents/" },
          { label: incident.incidentNumber },
        ]}
        summary={summary}
        timeline={timeline}
        related={related}
        showNotes={false}
        showAttachments={false}
        showAudit={false}
        showTimeline
        showRelated
        actions={
          <>
            <AutosaveIndicator
              status={autosaveStatus}
              error={autosaveError}
              {...(onRetryAutosave ? { onRetry: onRetryAutosave } : {})}
            />
            {saveAndExit}
          </>
        }
        statusBadge={<span className={styles.statusBadge}>{incident.status}</span>}
      >
        {children}
      </FxWorkspaceLayout>
    </div>
  );
}
