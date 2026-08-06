"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  Card,
  FixtureBanner,
  ForgeBreadcrumbs,
  ForgeMetricCard,
  ForgeMetricGrid,
  ForgePageHeader,
  LoadingIndicator,
  ErrorState,
} from "@forge/ui";
import { getMigrationStatusService } from "@/lib/migrations/mock-migration.service";
import type { MigrationDetail } from "@/lib/migrations/migration.types";

function MigrationDetailInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [detail, setDetail] = useState<MigrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!id) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      const next = await getMigrationStatusService().getMigration(id);
      if (cancelled) return;
      if (!next) setMissing(true);
      setDetail(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingIndicator label="Loading migration…" />;
  if (missing || !detail) {
    return (
      <ErrorState
        title="Migration unavailable"
        description="No migration record found for this id. Fixture data only exists for demo ids."
      />
    );
  }

  return (
    <div>
      <ForgePageHeader
        breadcrumbs={
          <ForgeBreadcrumbs
            items={[
              { label: "Migrations", href: "/migrations" },
              { label: detail.tenantDisplayName },
            ]}
            renderLink={({ href, children }) => <Link href={href!}>{children}</Link>}
          />
        }
        title={detail.tenantDisplayName}
        subtitle={`${detail.migrationType} · ${detail.source} → ${detail.destination}`}
        actions={<Badge>{detail.status}</Badge>}
      />
      <FixtureBanner>
        Fixture migration detail — adapter boundary only; no migration engine calls.
      </FixtureBanner>
      <ForgeMetricGrid>
        <ForgeMetricCard
          label="Progress"
          value={detail.progressPercent == null ? "—" : `${detail.progressPercent}%`}
        />
        <ForgeMetricCard label="Issues" value={detail.issueCount} />
        <ForgeMetricCard label="Users migrated" value={detail.users.migrated} />
        <ForgeMetricCard label="Users pending" value={detail.users.pending} />
      </ForgeMetricGrid>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
        }}
      >
        <Card title="Collections / tables">
          <ul>
            {detail.collections.map((c) => (
              <li key={c.name}>
                {c.name}: <Badge>{c.status}</Badge> ({c.recordCount ?? "—"})
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Documents / files">
          <ul>
            {detail.documents.map((d) => (
              <li key={d.name}>
                {d.name}: <Badge>{d.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Exceptions">
          {detail.exceptions.length === 0 ? <p>None</p> : null}
          <ul>
            {detail.exceptions.map((ex) => (
              <li key={ex.id}>
                [{ex.severity}] {ex.message}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Logs">
          <ul>
            {detail.logs.map((log, i) => (
              <li key={`${log.at}-${i}`}>
                {log.at} [{log.level}] {log.message}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p style={{ marginTop: "1rem" }}>
        <Link href="/migrations">Back to migrations</Link>
      </p>
    </div>
  );
}

export default function MigrationDetailPage() {
  return (
    <Suspense fallback={<LoadingIndicator label="Loading migration…" />}>
      <MigrationDetailInner />
    </Suspense>
  );
}
