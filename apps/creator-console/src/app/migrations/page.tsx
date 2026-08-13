"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  FixtureBanner,
  ForgeDataTable,
  ForgeMetricCard,
  ForgeMetricGrid,
  ForgePageHeader,
  LoadingIndicator,
  StatusBadge,
} from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { getMigrationStatusService } from "@/lib/migrations/mock-migration.service";
import type { MigrationSummary, MigrationUiStatus } from "@/lib/migrations/migration.types";

function countBy(rows: MigrationSummary[], predicate: (row: MigrationSummary) => boolean): number {
  return rows.filter(predicate).length;
}

function isActive(status: MigrationUiStatus): boolean {
  return status === "PREPARING" || status === "READY" || status === "IMPORTING";
}

function MigrationsInner() {
  const [rows, setRows] = useState<MigrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFixture, setUsingFixture] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await getMigrationStatusService().listMigrations();
      if (!cancelled) {
        setRows(list);
        setUsingFixture(list.some((r) => r.dataSource === "MOCK"));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    if (loading) {
      return {
        active: null as number | null,
        validation: null as number | null,
        failed: null as number | null,
        completed: null as number | null,
        cutoverPending: null as number | null,
      };
    }
    return {
      active: countBy(rows, (r) => isActive(r.status)),
      validation: countBy(rows, (r) => r.status === "VALIDATION_REQUIRED"),
      failed: countBy(rows, (r) => r.status === "FAILED"),
      completed: countBy(rows, (r) => r.status === "COMPLETE"),
      cutoverPending: countBy(rows, (r) => r.status === "VALIDATION_REQUIRED" || r.status === "READY"),
    };
  }, [loading, rows]);

  return (
    <div>
      <ForgePageHeader
        title="Migration Center"
        subtitle="Track tenant migration progress. Counts come from the active migration adapter only — never hardcoded production facts."
      />
      {usingFixture ? (
        <FixtureBanner>
          Showing development fixture migrations — not live production migration state. Do not treat these counts as DM-S0 facts.
        </FixtureBanner>
      ) : null}

      <ForgeMetricGrid>
        <ForgeMetricCard label="Active" value={metrics.active} />
        <ForgeMetricCard label="Validation" value={metrics.validation} />
        <ForgeMetricCard label="Failed" value={metrics.failed} />
        <ForgeMetricCard label="Completed" value={metrics.completed} />
        <ForgeMetricCard label="Cutover pending" value={metrics.cutoverPending} />
      </ForgeMetricGrid>

      {loading ? <LoadingIndicator label="Loading migrations…" /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState
          title="No migrations"
          description="Migration jobs will appear here when a live adapter is connected."
        />
      ) : null}

      <ForgeDataTable
        loading={loading}
        rows={rows}
        emptyTitle="No migrations"
        emptyDescription="Migration jobs will appear here when a live adapter is connected."
        columns={[
          {
            id: "tenant",
            header: "Customer",
            cell: (row) => (
              <Link href={`/migrations/detail/?id=${encodeURIComponent(row.id)}`}>{row.tenantDisplayName}</Link>
            ),
          },
          { id: "source", header: "Source", cell: (row) => row.source },
          { id: "destination", header: "Destination", cell: (row) => row.destination },
          { id: "type", header: "Type", cell: (row) => row.migrationType },
          {
            id: "status",
            header: "Status",
            cell: (row) => (
              <StatusBadge
                tone={
                  row.status === "FAILED"
                    ? "danger"
                    : row.status === "COMPLETE"
                      ? "success"
                      : row.status === "VALIDATION_REQUIRED"
                        ? "warning"
                        : "info"
                }
              >
                {row.status}
              </StatusBadge>
            ),
          },
          {
            id: "progress",
            header: "Progress",
            cell: (row) => (row.progressPercent == null ? "Not available" : `${row.progressPercent}%`),
          },
          { id: "issues", header: "Issues", cell: (row) => String(row.issueCount) },
          {
            id: "sourceTag",
            header: "Data",
            cell: (row) => <StatusBadge tone={row.dataSource === "LIVE" ? "success" : "neutral"}>{row.dataSource}</StatusBadge>,
          },
        ]}
      />
    </div>
  );
}

export default function MigrationsPage() {
  return (
    <PlatformPageGate title="Migration Center" anyOf={["platform.tenant.read", "import.view"]}>
      <MigrationsInner />
    </PlatformPageGate>
  );
}
