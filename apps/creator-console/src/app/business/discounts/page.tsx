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
  unwrapItems,
  type CommercialDiscountListItem,
} from "@/lib/commercial-api";
import { formatDate, formatUsd, planStatusLabel } from "@/lib/commercial-format";
import styles from "../../page.module.css";

function discountValueLabel(row: CommercialDiscountListItem): string {
  if (row.discountType === "PERCENT" && row.percentBps != null) {
    return `${(row.percentBps / 100).toFixed(2)}%`;
  }
  if (row.discountType === "FIXED") {
    return formatUsd(row.amountCents);
  }
  return "—";
}

export default function BusinessDiscountsPage() {
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.discount.manage") ||
    hasPermission("platform.billing.view") ||
    hasPermission("platform.entitlement.manage");

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialDiscountListItem[]>([]);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const result = await commercialGet<
      CommercialDiscountListItem[] | { items: CommercialDiscountListItem[] }
    >(COMMERCIAL_PATHS.discounts);
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
      title="Discounts"
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · Discount definitions"}
        </>
      }
      width="wide"
    >
      {!canView ? (
        <p className={styles.error}>Missing permission: platform.discount.manage</p>
      ) : null}

      <ForgeToolbar
        actions={
          <button type="button" className="forge-btn forge-btn--secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? (
        <ForgePageSection title="Discounts">
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
        <ForgePageSection title="Discount catalog">
          {items.length === 0 ? (
            <EmptyState
              title="No discounts defined"
              description="Platform and tenant discount definitions will appear here."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Window</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.discountType}</td>
                    <td>{discountValueLabel(row)}</td>
                    <td>
                      <ForgeStatusBadge
                        status={row.status}
                        label={planStatusLabel(row.status)}
                      />
                    </td>
                    <td>
                      {formatDate(row.startsAt)} – {formatDate(row.endsAt)}
                    </td>
                    <td>{row.tenantId ? "Tenant" : "Platform"}</td>
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
