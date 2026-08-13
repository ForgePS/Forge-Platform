"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CreatorPage,
  EmptyState,
  ErrorState,
  ForgePageSection,
  ForgeSkeleton,
  ForgeStatusBadge,
  ForgeToolbar,
} from "@/components/creator-page";
import { useAuth } from "@/hooks/use-auth";
import {
  COMMERCIAL_BACKEND_CONDITION,
  COMMERCIAL_PATHS,
  commercialGet,
  subscriptionDetailHref,
  unwrapItems,
  type CommercialContractListItem,
} from "@/lib/commercial-api";
import {
  contractStatusLabel,
  formatDate,
} from "@/lib/commercial-format";
import styles from "../../page.module.css";

export default function BusinessContractsPage() {
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.contract.view") ||
    hasPermission("platform.contract.manage") ||
    hasPermission("platform.billing.view") ||
    hasPermission("platform.entitlement.manage");

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialContractListItem[]>([]);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const result = await commercialGet<
      CommercialContractListItem[] | { items: CommercialContractListItem[] }
    >(COMMERCIAL_PATHS.contracts);
    if (result.status === "unavailable") {
      setUnavailable(true);
      setItems([]);
    } else if (result.status === "error") {
      setError(result.message);
      setItems([]);
    } else {
      setItems(unwrapItems(result.data));
    }
    setLoading(false);
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <CreatorPage
      title="Contracts"
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · Contract metadata (no e-sign)"}
        </>
      }
      width="wide"
    >
      {!canView ? (
        <p className={styles.error}>Missing permission: platform.contract.view</p>
      ) : null}

      <ForgeToolbar
        actions={
          <button type="button" className="forge-btn forge-btn--secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? (
        <ForgePageSection title="Contracts">
          <ForgeSkeleton height="6rem" />
        </ForgePageSection>
      ) : null}

      {!loading && unavailable ? (
        <EmptyState
          title="Commercial API not available"
          description={COMMERCIAL_BACKEND_CONDITION}
        />
      ) : null}

      {!loading && error && !unavailable ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}

      {!loading && !unavailable && !error && canView ? (
        <ForgePageSection title="Contracts">
          {items.length === 0 ? (
            <EmptyState
              title="No contracts on file"
              description="Contract metadata linked to subscriptions will appear here."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Effective</th>
                  <th>Subscription</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>{row.contractNumber}</td>
                    <td>{row.tenantDisplayName ?? "—"}</td>
                    <td>{row.title}</td>
                    <td>{row.contractType ?? "—"}</td>
                    <td>
                      <ForgeStatusBadge
                        status={row.status}
                        label={contractStatusLabel(row.status)}
                      />
                    </td>
                    <td>
                      {formatDate(row.effectiveFrom)} – {formatDate(row.effectiveTo)}
                    </td>
                    <td>
                      {row.subscriptionId ? (
                        <Link href={subscriptionDetailHref(row.subscriptionId, row.tenantId)}>
                          Open
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ForgePageSection>
      ) : null}
    </CreatorPage>
  );
}
