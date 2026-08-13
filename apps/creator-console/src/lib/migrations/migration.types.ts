/**
 * Migration Center contracts for Creator Console UI.
 * No migration engine logic — adapters only.
 */

export type MigrationUiStatus =
  | "NOT_STARTED"
  | "PREPARING"
  | "READY"
  | "IMPORTING"
  | "VALIDATION_REQUIRED"
  | "COMPLETE"
  | "FAILED"
  | "STATUS_UNAVAILABLE";

export type MigrationSummary = {
  id: string;
  tenantDisplayName: string;
  tenantId: string;
  source: string;
  destination: string;
  migrationType: string;
  startedAt: string | null;
  status: MigrationUiStatus;
  progressPercent: number | null;
  validationSummary: string;
  issueCount: number;
  updatedAt: string;
  dataSource: "LIVE" | "MOCK" | "NOT_CONNECTED";
};

export type ReconciliationRow = {
  category: string;
  source: number;
  transformed: number;
  imported: number;
  difference: number;
  status: "Complete" | "Needs Review" | "Blocked";
};

export type ReconciliationDiscrepancy = {
  id: string;
  category: string;
  entity: string;
  sourceIdentifier: string;
  problem: string;
  recommendedResolution: string;
  disposition: "Open" | "Mapped" | "Excluded" | "Retried";
};

export type LaunchChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
};

export type MigrationDetail = MigrationSummary & {
  collections: Array<{ name: string; status: MigrationUiStatus; recordCount: number | null }>;
  documents: Array<{ name: string; status: MigrationUiStatus }>;
  users: { migrated: number | null; pending: number | null; failed: number | null };
  exceptions: Array<{ id: string; message: string; severity: "info" | "warning" | "error" }>;
  logs: Array<{ at: string; level: string; message: string }>;
  reconciliationRows?: ReconciliationRow[];
  discrepancies?: ReconciliationDiscrepancy[];
};

export interface MigrationStatusService {
  listMigrations(): Promise<MigrationSummary[]>;
  getMigration(id: string): Promise<MigrationDetail | null>;
}

/** Friendly labels for migration stage badges in the UI. */
export function migrationStageLabel(status: MigrationUiStatus): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "PREPARING":
      return "Preparing";
    case "READY":
      return "Ready";
    case "IMPORTING":
      return "Importing";
    case "VALIDATION_REQUIRED":
      return "Validation required";
    case "COMPLETE":
      return "Complete";
    case "FAILED":
      return "Failed";
    case "STATUS_UNAVAILABLE":
      return "Status unavailable";
    default:
      return status;
  }
}
