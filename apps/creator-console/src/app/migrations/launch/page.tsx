"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FixtureBanner,
  ForgeBreadcrumbs,
  ForgePageSection,
  ErrorState,
} from "@forge/ui";
import { CreatorLoading, CreatorPage } from "@/components/creator-page";
import { getLaunchChecklist } from "@/lib/migrations/mock-migration.service";
import type {
  LaunchChecklistItem,
  MigrationDetail,
} from "@/lib/migrations/migration.types";
import styles from "../../page.module.css";

function LaunchInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [detail, setDetail] = useState<MigrationDetail | null>(null);
  const [items, setItems] = useState<LaunchChecklistItem[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [readyForLaunch, setReadyForLaunch] = useState(false);
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
      const next = await getLaunchChecklist(id);
      if (cancelled) return;
      if (!next.detail) setMissing(true);
      setDetail(next.detail);
      setItems(next.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const requiredComplete = useMemo(
    () => items.filter((i) => i.required).every((i) => i.complete),
    [items],
  );

  const nameMatches =
    Boolean(detail) &&
    confirmation.trim().toLowerCase() === detail!.tenantDisplayName.trim().toLowerCase();

  const canMarkReady = requiredComplete && nameMatches && !readyForLaunch;

  function toggleItem(itemId: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, complete: !item.complete } : item,
      ),
    );
  }

  if (loading) {
    return <CreatorLoading label="Loading launch checklist…" />;
  }

  if (missing || !detail) {
    return (
      <CreatorPage title="Launch Customer">
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
      title="Launch Customer"
      subtitle={`${detail.tenantDisplayName} · readiness gates only — cutover is performed by operations`}
    >
      <ForgeBreadcrumbs
        items={[
          { label: "Migrations", href: "/migrations" },
          {
            label: detail.tenantDisplayName,
            href: `/migrations/detail?id=${encodeURIComponent(detail.id)}`,
          },
          { label: "Launch Customer" },
        ]}
        renderLink={({ href, children }) => <Link href={href!}>{children}</Link>}
      />

      {detail.dataSource === "MOCK" ? (
        <FixtureBanner>
          Development fixture — checklist state is local only and does not call cutover APIs.
        </FixtureBanner>
      ) : null}

      {readyForLaunch ? (
        <p className={styles.success}>
          READY FOR LAUNCH — marked in this browser only. Launch is performed separately by
          operations; this console does not execute cutover.
        </p>
      ) : (
        <p className={styles.muted}>
          Complete all required checklist items and type the customer display name to confirm
          readiness. Launch itself is performed separately by operations.
        </p>
      )}

      <ForgePageSection title="Launch checklist">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.65rem" }}>
          {items.map((item) => (
            <li key={item.id}>
              <label className={styles.permItem}>
                <input
                  type="checkbox"
                  checked={item.complete}
                  disabled={readyForLaunch}
                  onChange={() => toggleItem(item.id)}
                />
                <span>
                  {item.label}
                  {item.required ? (
                    <span className={styles.muted}> · required</span>
                  ) : (
                    <span className={styles.muted}> · optional</span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </ForgePageSection>

      <ForgePageSection title="Confirmation">
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!canMarkReady) return;
            setReadyForLaunch(true);
          }}
        >
          <div className={styles.formRow}>
            <label htmlFor="launch-confirm">
              Type customer display name to confirm:{" "}
              <strong>{detail.tenantDisplayName}</strong>
            </label>
            <input
              id="launch-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={readyForLaunch}
              autoComplete="off"
              placeholder={detail.tenantDisplayName}
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className="forge-btn" disabled={!canMarkReady}>
              Mark ready for launch
            </button>
            <Link
              className="forge-btn forge-btn--secondary"
              href={`/migrations/reconciliation?id=${encodeURIComponent(detail.id)}`}
            >
              Back to reconciliation
            </Link>
          </div>
        </form>
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function LaunchCustomerPage() {
  return (
    <Suspense fallback={<CreatorLoading label="Loading launch checklist…" />}>
      <LaunchInner />
    </Suspense>
  );
}
