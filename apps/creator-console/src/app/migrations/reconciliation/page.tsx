"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FixtureBanner,
  ForgeBreadcrumbs,
  ForgePageSection,
  ForgeStatusBadge,
  ErrorState,
} from "@forge/ui";
import { CreatorLoading, CreatorPage } from "@/components/creator-page";
import { getReconciliation } from "@/lib/migrations/mock-migration.service";
import type {
  MigrationDetail,
  ReconciliationDiscrepancy,
  ReconciliationRow,
} from "@/lib/migrations/migration.types";
import styles from "../../page.module.css";

function statusBadgeClass(status: ReconciliationRow["status"]): string {
  if (status === "Complete") return styles.badgeOk ?? "";
  if (status === "Needs Review") return styles.badgeWarn ?? "";
  return styles.badgeBad ?? "";
}

function ReconciliationInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [detail, setDetail] = useState<MigrationDetail | null>(null);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [discrepancies, setDiscrepancies] = useState<ReconciliationDiscrepancy[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
      const next = await getReconciliation(id);
      if (cancelled) return;
      if (!next.detail) setMissing(true);
      setDetail(next.detail);
      setRows(next.rows);
      setDiscrepancies(next.discrepancies);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const filteredDiscrepancies = useMemo(() => {
    if (!selectedCategory) return [];
    return discrepancies.filter((d) => d.category === selectedCategory);
  }, [discrepancies, selectedCategory]);

  function setDisposition(discId: string, disposition: ReconciliationDiscrepancy["disposition"]) {
    setDiscrepancies((prev) =>
      prev.map((d) => (d.id === discId ? { ...d, disposition } : d)),
    );
  }

  if (loading) {
    return <CreatorLoading label="Loading reconciliation…" />;
  }

  if (missing || !detail) {
    return (
      <CreatorPage title="Reconciliation">
        <ErrorState
          title="Migration unavailable"
          description="No migration record found for this id. Fixture data only exists for demo ids."
        />
        <p style={{ marginTop: "1rem" }}>
          <Link href="/migrations">Back to migrations</Link>
        </p>
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      width="wide"
      title="Reconciliation"
      subtitle={`${detail.tenantDisplayName} · ${detail.migrationType}`}
      actions={
        <Link
          className="forge-btn"
          href={`/migrations/launch?id=${encodeURIComponent(detail.id)}`}
        >
          Launch Customer
        </Link>
      }
    >
      <ForgeBreadcrumbs
        items={[
          { label: "Migrations", href: "/migrations" },
          {
            label: detail.tenantDisplayName,
            href: `/migrations/detail?id=${encodeURIComponent(detail.id)}`,
          },
          { label: "Reconciliation" },
        ]}
        renderLink={({ href, children }) => <Link href={href!}>{children}</Link>}
      />

      {detail.dataSource === "MOCK" ? (
        <FixtureBanner>
          Development fixture — reconciliation counts and discrepancies are mock data only.
        </FixtureBanner>
      ) : null}

      <ForgePageSection title="Category totals">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Source</th>
              <th>Transformed</th>
              <th>Imported</th>
              <th>Difference</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.category}
                style={{
                  cursor: "pointer",
                  background:
                    selectedCategory === row.category
                      ? "var(--forge-color-primary-soft)"
                      : undefined,
                }}
                onClick={() =>
                  setSelectedCategory((prev) =>
                    prev === row.category ? null : row.category,
                  )
                }
              >
                <td>{row.category}</td>
                <td>{row.source}</td>
                <td>{row.transformed}</td>
                <td>{row.imported}</td>
                <td>{row.difference}</td>
                <td>
                  <span className={statusBadgeClass(row.status)}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.muted} style={{ marginTop: "0.75rem" }}>
          Click a row to inspect discrepancies for that category.
        </p>
      </ForgePageSection>

      {selectedCategory ? (
        <ForgePageSection title={`Discrepancies · ${selectedCategory}`}>
          {filteredDiscrepancies.length === 0 ? (
            <p className={styles.muted}>No open discrepancies for this category.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Source ID</th>
                  <th>Problem</th>
                  <th>Recommended</th>
                  <th>Disposition</th>
                  <th>Actions (fixture)</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscrepancies.map((d) => (
                  <tr key={d.id}>
                    <td>{d.entity}</td>
                    <td className={styles.mono}>{d.sourceIdentifier}</td>
                    <td>{d.problem}</td>
                    <td>{d.recommendedResolution}</td>
                    <td>
                      <ForgeStatusBadge status={d.disposition} />
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className="forge-btn forge-btn--outline"
                          onClick={() => setDisposition(d.id, "Mapped")}
                        >
                          Map
                        </button>
                        <button
                          type="button"
                          className="forge-btn forge-btn--secondary"
                          onClick={() => setDisposition(d.id, "Retried")}
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          className="forge-btn forge-btn--outline"
                          onClick={() => setDisposition(d.id, "Excluded")}
                        >
                          Exclude
                        </button>
                      </div>
                      <p className={styles.muted} style={{ marginTop: "0.35rem", fontSize: "0.8rem" }}>
                        Fixture only — updates local state
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ForgePageSection>
      ) : null}

      <div className={styles.linkRow}>
        <Link href={`/migrations/detail?id=${encodeURIComponent(detail.id)}`}>
          Back to migration detail
        </Link>
        <Link href={`/migrations/launch?id=${encodeURIComponent(detail.id)}`}>
          Launch Customer
        </Link>
      </div>
    </CreatorPage>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<CreatorLoading label="Loading reconciliation…" />}>
      <ReconciliationInner />
    </Suspense>
  );
}
