"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, FixtureBanner, ForgeDataTable, ForgePageContainer, ForgePageHeader, LoadingIndicator } from "@forge/ui";
import { getMigrationStatusService } from "@/lib/migrations/mock-migration.service";
import type { MigrationSummary } from "@/lib/migrations/migration.types";

export default function MigrationsPage() {
  const [rows, setRows] = useState<MigrationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await getMigrationStatusService().listMigrations();
      if (!cancelled) {
        setRows(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ForgePageContainer width="wide">
      <ForgePageHeader
        title="Data migration"
        subtitle="Track tenant migration progress while AWS cutover continues. This center does not run migration jobs."
      />
      <FixtureBanner>
        Showing development fixture migrations — not live production migration state.
      </FixtureBanner>
      {loading ? <LoadingIndicator label="Loading migrations…" /> : null}
      <ForgeDataTable
        loading={loading}
        rows={rows}
        emptyTitle="No migrations"
        emptyDescription="Migration jobs will appear here when a live adapter is connected."
        columns={[
          {
            id: "tenant",
            header: "Tenant",
            cell: (row) => (
              <Link href={`/migrations/detail?id=${encodeURIComponent(row.id)}`}>
                {row.tenantDisplayName}
              </Link>
            ),
          },
          { id: "source", header: "Source", cell: (row) => row.source },
          { id: "destination", header: "Destination", cell: (row) => row.destination },
          { id: "type", header: "Type", cell: (row) => row.migrationType },
          {
            id: "status",
            header: "Status",
            cell: (row) => <Badge>{row.status}</Badge>,
          },
          {
            id: "progress",
            header: "Progress",
            cell: (row) => (row.progressPercent == null ? "—" : `${row.progressPercent}%`),
          },
          { id: "issues", header: "Issues", cell: (row) => String(row.issueCount) },
          {
            id: "sourceTag",
            header: "Data",
            cell: (row) => <Badge>{row.dataSource}</Badge>,
          },
        ]}
      />
    </ForgePageContainer>
  );
}
