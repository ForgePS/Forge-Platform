"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  CreatorLoading,
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
  invoiceDetailHref,
  unwrapItems,
  type CommercialInvoiceListItem,
} from "@/lib/commercial-api";
import {
  INVOICE_STATUSES,
  formatDate,
  formatUsd,
  invoiceStatusLabel,
} from "@/lib/commercial-format";
import styles from "../../page.module.css";

function InvoicesInner() {
  const searchParams = useSearchParams();
  const tenantIdFilter = searchParams.get("tenantId")?.trim() ?? "";
  const subscriptionIdFilter = searchParams.get("subscriptionId")?.trim() ?? "";

  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.billing.view") ||
    hasPermission("platform.subscription.view") ||
    hasPermission("platform.entitlement.manage");

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialInvoiceListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const path = tenantIdFilter
      ? COMMERCIAL_PATHS.tenantInvoices(tenantIdFilter)
      : COMMERCIAL_PATHS.invoices;
    const result = await commercialGet<
      CommercialInvoiceListItem[] | { items: CommercialInvoiceListItem[] }
    >(path, {
      query: {
        status: statusFilter || undefined,
        subscriptionId: subscriptionIdFilter || undefined,
      },
    });
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
  }, [canView, statusFilter, subscriptionIdFilter, tenantIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <CreatorPage
      title="Invoices"
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · Manual billing invoices"}
        </>
      }
      width="wide"
    >
      {!canView ? (
        <p className={styles.error}>Missing permission: platform.billing.view</p>
      ) : null}

      <ForgeToolbar
        actions={
          <button type="button" className="forge-btn forge-btn--secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      >
        <select
          className="forge-select"
          aria-label="Invoice status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {invoiceStatusLabel(s)}
            </option>
          ))}
        </select>
      </ForgeToolbar>

      {tenantIdFilter || subscriptionIdFilter ? (
        <p className={styles.muted}>
          Filtered
          {tenantIdFilter ? ` · tenant ${tenantIdFilter.slice(0, 8)}…` : ""}
          {subscriptionIdFilter ? ` · subscription ${subscriptionIdFilter.slice(0, 8)}…` : ""}
        </p>
      ) : null}

      {loading ? (
        <ForgePageSection title="Invoices">
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
        <ForgePageSection title="Invoice list">
          {items.length === 0 ? (
            <EmptyState
              title="No invoices"
              description="Invoices appear here after they are created from commercial subscriptions."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={invoiceDetailHref(row.id, row.tenantId)}>
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td>{row.tenantDisplayName ?? "—"}</td>
                    <td>
                      <ForgeStatusBadge
                        status={row.status}
                        label={invoiceStatusLabel(row.status)}
                      />
                    </td>
                    <td>{formatDate(row.issueDate)}</td>
                    <td>{formatDate(row.dueDate)}</td>
                    <td>{formatUsd(row.totalCents)}</td>
                    <td>{formatUsd(row.balanceCents)}</td>
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

export default function BusinessInvoicesPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <InvoicesInner />
    </Suspense>
  );
}
