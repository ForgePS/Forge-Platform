import type {
  LaunchChecklistItem,
  MigrationDetail,
  MigrationStatusService,
  MigrationSummary,
  ReconciliationDiscrepancy,
  ReconciliationRow,
} from "./migration.types";

/**
 * Development fixture adapter for Migration Center visuals.
 * Never treat as production data. Gated by app env in the UI layer.
 */
const FIXTURES: MigrationSummary[] = [
  {
    id: "mig_demo_producers_phase2",
    tenantDisplayName: "Producers Rice Mill (fixture)",
    tenantId: "00000000-0000-4000-8000-000000000101",
    source: "Firebase (legacy Industrial)",
    destination: "AWS Aurora (Forge Platform)",
    migrationType: "Industrial tenant cutover",
    startedAt: "2026-08-01T15:00:00.000Z",
    status: "VALIDATION_REQUIRED",
    progressPercent: 72,
    validationSummary: "3 collections require reconciliation review",
    issueCount: 3,
    updatedAt: "2026-08-05T18:30:00.000Z",
    dataSource: "MOCK",
  },
  {
    id: "mig_demo_academy_pilot",
    tenantDisplayName: "Academy Pilot (fixture)",
    tenantId: "00000000-0000-4000-8000-000000000102",
    source: "CSV import package",
    destination: "AWS Aurora (Forge Platform)",
    migrationType: "Academy roster bootstrap",
    startedAt: null,
    status: "NOT_STARTED",
    progressPercent: 0,
    validationSummary: "Not started",
    issueCount: 0,
    updatedAt: "2026-08-04T12:00:00.000Z",
    dataSource: "MOCK",
  },
];

function reconciliationFor(summary: MigrationSummary): {
  reconciliationRows: ReconciliationRow[];
  discrepancies: ReconciliationDiscrepancy[];
} {
  if (summary.id === "mig_demo_academy_pilot") {
    return {
      reconciliationRows: [
        { category: "Personnel", source: 0, transformed: 0, imported: 0, difference: 0, status: "Complete" },
        { category: "Inspections", source: 0, transformed: 0, imported: 0, difference: 0, status: "Complete" },
        { category: "Incidents", source: 0, transformed: 0, imported: 0, difference: 0, status: "Complete" },
        { category: "Training", source: 0, transformed: 0, imported: 0, difference: 0, status: "Complete" },
        { category: "Documents", source: 0, transformed: 0, imported: 0, difference: 0, status: "Complete" },
      ],
      discrepancies: [],
    };
  }

  return {
    reconciliationRows: [
      {
        category: "Personnel",
        source: 142,
        transformed: 140,
        imported: 138,
        difference: 4,
        status: "Needs Review",
      },
      {
        category: "Inspections",
        source: 856,
        transformed: 856,
        imported: 856,
        difference: 0,
        status: "Complete",
      },
      {
        category: "Incidents",
        source: 64,
        transformed: 62,
        imported: 60,
        difference: 4,
        status: "Needs Review",
      },
      {
        category: "Training",
        source: 210,
        transformed: 208,
        imported: 205,
        difference: 5,
        status: "Needs Review",
      },
      {
        category: "Documents",
        source: 1180,
        transformed: 1175,
        imported: 1170,
        difference: 10,
        status: "Blocked",
      },
    ],
    discrepancies: [
      {
        id: "disc_pers_01",
        category: "Personnel",
        entity: "Employee",
        sourceIdentifier: "EMP-044",
        problem: "Duplicate employee number on roster row 44 (fixture)",
        recommendedResolution: "Map to existing person EMP-012 or exclude duplicate",
        disposition: "Open",
      },
      {
        id: "disc_pers_02",
        category: "Personnel",
        entity: "Employee",
        sourceIdentifier: "EMP-091",
        problem: "Missing required site assignment (fixture)",
        recommendedResolution: "Map to primary mill site or exclude until corrected",
        disposition: "Open",
      },
      {
        id: "disc_inc_01",
        category: "Incidents",
        entity: "Incident",
        sourceIdentifier: "INC-2024-118",
        problem: "Legacy severity code not in Forge value set (fixture)",
        recommendedResolution: "Map severity HIGH→SERIOUS or exclude record",
        disposition: "Open",
      },
      {
        id: "disc_trn_01",
        category: "Training",
        entity: "Training record",
        sourceIdentifier: "TRN-8821",
        problem: "Instructor person key unresolved after transform (fixture)",
        recommendedResolution: "Retry after personnel mapping, or exclude orphaned record",
        disposition: "Open",
      },
      {
        id: "disc_doc_01",
        category: "Documents",
        entity: "SOP attachment",
        sourceIdentifier: "DOC-CS-07",
        problem: "Binary blob missing from source export (fixture)",
        recommendedResolution: "Exclude until source re-export provides file",
        disposition: "Open",
      },
    ],
  };
}

function launchChecklistFor(summary: MigrationSummary): LaunchChecklistItem[] {
  const reconciliationDone = summary.status === "COMPLETE";
  return [
    {
      id: "recon_signed",
      label: "Reconciliation signed off by customer admin",
      complete: reconciliationDone,
      required: true,
    },
    {
      id: "users_verified",
      label: "User accounts verified and credentials communicated",
      complete: summary.progressPercent != null && summary.progressPercent >= 70,
      required: true,
    },
    {
      id: "entitlements",
      label: "Product entitlements configured for go-live",
      complete: summary.id === "mig_demo_producers_phase2",
      required: true,
    },
    {
      id: "dns_ready",
      label: "Customer subdomain / DNS ready",
      complete: false,
      required: true,
    },
    {
      id: "ops_briefed",
      label: "Operations briefed on cutover window",
      complete: false,
      required: true,
    },
    {
      id: "rollback_plan",
      label: "Rollback contact list documented (optional)",
      complete: true,
      required: false,
    },
  ];
}

function detailFor(summary: MigrationSummary): MigrationDetail {
  const { reconciliationRows, discrepancies } = reconciliationFor(summary);
  return {
    ...summary,
    collections: [
      { name: "personnel", status: "COMPLETE", recordCount: 128 },
      { name: "incidents", status: "IMPORTING", recordCount: 40 },
      { name: "training", status: "VALIDATION_REQUIRED", recordCount: 12 },
    ],
    documents: [
      { name: "sops", status: "READY" },
      { name: "attachments", status: "NOT_STARTED" },
    ],
    users: { migrated: 18, pending: 4, failed: 1 },
    exceptions: [
      {
        id: "ex_1",
        severity: "warning",
        message: "Duplicate employee number on roster row 44 (fixture)",
      },
      {
        id: "ex_2",
        severity: "error",
        message: "Missing required site code on confined-space permit (fixture)",
      },
    ],
    logs: [
      {
        at: "2026-08-05T18:30:00.000Z",
        level: "INFO",
        message: "Validation batch completed (fixture)",
      },
      {
        at: "2026-08-05T17:10:00.000Z",
        level: "WARN",
        message: "Skipped 2 unsupported legacy form templates (fixture)",
      },
    ],
    reconciliationRows,
    discrepancies,
  };
}

export const mockMigrationStatusService: MigrationStatusService = {
  async listMigrations() {
    return FIXTURES;
  },
  async getMigration(id: string) {
    const summary = FIXTURES.find((m) => m.id === id);
    return summary ? detailFor(summary) : null;
  },
};

/** Resolve the active adapter. Live backend is not wired yet. */
export function getMigrationStatusService(): MigrationStatusService {
  return mockMigrationStatusService;
}

export async function getReconciliation(id: string): Promise<{
  detail: MigrationDetail | null;
  rows: ReconciliationRow[];
  discrepancies: ReconciliationDiscrepancy[];
}> {
  const detail = await getMigrationStatusService().getMigration(id);
  if (!detail) {
    return { detail: null, rows: [], discrepancies: [] };
  }
  return {
    detail,
    rows: detail.reconciliationRows ?? [],
    discrepancies: detail.discrepancies ?? [],
  };
}

export async function getLaunchChecklist(id: string): Promise<{
  detail: MigrationDetail | null;
  items: LaunchChecklistItem[];
}> {
  const summary = FIXTURES.find((m) => m.id === id) ?? null;
  if (!summary) {
    return { detail: null, items: [] };
  }
  return {
    detail: detailFor(summary),
    items: launchChecklistFor(summary),
  };
}
