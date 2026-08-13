"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  CreatorLoading,
  CreatorPage,
  EmptyState,
  ErrorState,
  ForgeContextBar,
  ForgePageSection,
  ForgeSkeleton,
  ForgeStatusBadge,
} from "@/components/creator-page";
import { useAuth } from "@/hooks/use-auth";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import {
  COMMERCIAL_BACKEND_CONDITION,
  COMMERCIAL_PATHS,
  commercialGet,
  commercialSend,
  subscriptionDetailHref,
  type CommercialInvoiceDetail,
} from "@/lib/commercial-api";
import {
  formatDate,
  formatUsd,
  invoiceStatusLabel,
} from "@/lib/commercial-format";
import styles from "../../../page.module.css";

function InvoiceDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() ?? "";
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.billing.view") ||
    hasPermission("platform.subscription.view") ||
    hasPermission("platform.entitlement.manage");
  const canVoid = hasPermission("platform.invoice.void");
  const canUpdate = hasPermission("platform.invoice.update");

  const [loading, setLoading] = useState(Boolean(id && tenantId));
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState<CommercialInvoiceDetail | null>(null);

  const load = useCallback(async () => {
    if (!id || !tenantId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const result = await commercialGet<CommercialInvoiceDetail>(
      COMMERCIAL_PATHS.tenantInvoice(tenantId, id),
    );
    if (result.status === "unavailable") {
      setUnavailable(true);
      setInvoice(null);
    } else if (result.status === "error") {
      setError(result.message);
      setInvoice(null);
    } else {
      setInvoice(result.data);
    }
    setLoading(false);
  }, [canView, id, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: "finalize" | "void") {
    if (!invoice) return;
    setActionError(null);
    setBusy(true);
    const result = await commercialSend(
      `${COMMERCIAL_PATHS.tenantInvoice(tenantId, id)}/${action}`,
      "POST",
      action === "void" ? { reason: "Voided from Creator Console" } : undefined,
    );
    setBusy(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    await load();
  }

  if (!id || !tenantId) {
    return (
      <CreatorPage title="Invoice">
        <EmptyState
          title="Invoice not specified"
          description="Open an invoice with id and tenantId query parameters."
          action={
            <Link className="forge-btn forge-btn--outline" href="/business/invoices">
              Back to invoices
            </Link>
          }
        />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title={invoice?.invoiceNumber ?? "Invoice"}
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · "}
          <Link href="/business/invoices">Invoices</Link>
        </>
      }
      width="wide"
      actions={
        invoice ? (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {canUpdate && invoice.status === "DRAFT" ? (
              <button
                type="button"
                className="forge-btn forge-btn--primary"
                disabled={busy}
                onClick={() => void run("finalize")}
              >
                Finalize
              </button>
            ) : null}
            {canVoid && invoice.status !== "VOID" && invoice.status !== "PAID" ? (
              <button
                type="button"
                className="forge-btn forge-btn--secondary"
                disabled={busy}
                onClick={() => void run("void")}
              >
                Void
              </button>
            ) : null}
            <Link
              className="forge-btn forge-btn--outline"
              href={`/business/payments?tenantId=${encodeURIComponent(tenantId)}&invoiceId=${encodeURIComponent(id)}`}
            >
              Record payment
            </Link>
            <button
              type="button"
              className="forge-btn forge-btn--outline"
              onClick={() => window.print()}
            >
              Download PDF / Print
            </button>
          </div>
        ) : undefined
      }
    >
      {loading ? <ForgeSkeleton height="4rem" /> : null}
      {!loading && unavailable ? (
        <EmptyState
          title="Commercial API not available"
          description={COMMERCIAL_BACKEND_CONDITION}
        />
      ) : null}
      {!loading && error && !unavailable ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}
      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      {!loading && invoice ? (
        <>
          <ForgeContextBar
            title={invoice.tenantDisplayName ?? "Customer"}
            status={
              <ForgeStatusBadge
                status={invoice.status}
                label={invoiceStatusLabel(invoice.status)}
              />
            }
            subtitle={`Total ${formatUsd(invoice.totalCents)} · Balance ${formatUsd(invoice.balanceCents)}`}
            meta={<span>Due {formatDate(invoice.dueDate)}</span>}
            actions={
              <Link className="forge-btn forge-btn--outline" href={tenantDetailHref(tenantId)}>
                Open customer
              </Link>
            }
          />

          <ForgePageSection title="Summary">
            <dl className={styles.dl}>
              <dt>Invoice number</dt>
              <dd className={styles.mono}>{invoice.invoiceNumber}</dd>
              <dt>Issue date</dt>
              <dd>{formatDate(invoice.issueDate)}</dd>
              <dt>Due date</dt>
              <dd>{formatDate(invoice.dueDate)}</dd>
              <dt>Subtotal</dt>
              <dd>{formatUsd(invoice.subtotalCents)}</dd>
              <dt>Discount</dt>
              <dd>{formatUsd(invoice.discountCents)}</dd>
              <dt>Tax</dt>
              <dd>{formatUsd(invoice.taxCents)}</dd>
              <dt>Credits</dt>
              <dd>{formatUsd(invoice.creditCents)}</dd>
              <dt>Total</dt>
              <dd>{formatUsd(invoice.totalCents)}</dd>
              <dt>Amount paid</dt>
              <dd>{formatUsd(invoice.amountPaidCents)}</dd>
              <dt>Balance</dt>
              <dd>{formatUsd(invoice.balanceCents)}</dd>
              <dt>Billing provider</dt>
              <dd>{invoice.billingProvider ?? "MANUAL"}</dd>
              <dt>Subscription</dt>
              <dd>
                {invoice.subscriptionId ? (
                  <Link href={subscriptionDetailHref(invoice.subscriptionId, tenantId)}>
                    Open subscription
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Notes</dt>
              <dd>{invoice.notes ?? "—"}</dd>
            </dl>
          </ForgePageSection>

          <ForgePageSection title="Line items">
            {!invoice.lineItems?.length ? (
              <EmptyState
                title="No line items"
                description="Invoice line items will appear here when present."
              />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((line, idx) => (
                    <tr key={line.id ?? `${line.description}-${idx}`}>
                      <td>{line.lineType}</td>
                      <td>{line.description}</td>
                      <td>{line.quantity}</td>
                      <td>{formatUsd(line.unitPriceCents)}</td>
                      <td>{formatUsd(line.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ForgePageSection>
          <ForgePageSection title="Printable invoice">
            <div className={styles.invoicePrint} id="forge-invoice-print">
              <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Forge Public Safety</p>
              <p className={styles.muted} style={{ marginTop: 0 }}>
                Invoice {invoice.invoiceNumber}
              </p>
              <p>
                Bill to: {invoice.tenantDisplayName ?? "Customer"}
                {invoice.billingContactEmail ? ` · ${invoice.billingContactEmail}` : ""}
              </p>
              <p>
                Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)} ·{" "}
                {invoiceStatusLabel(invoice.status)}
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.lineItems ?? []).map((line, idx) => (
                    <tr key={line.id ?? `print-${idx}`}>
                      <td>{line.description}</td>
                      <td>{line.quantity}</td>
                      <td>{formatUsd(line.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className={styles.dl}>
                <dt>Subtotal</dt>
                <dd>{formatUsd(invoice.subtotalCents)}</dd>
                <dt>Total</dt>
                <dd>{formatUsd(invoice.totalCents)}</dd>
                <dt>Balance due</dt>
                <dd>{formatUsd(invoice.balanceCents)}</dd>
                <dt>Payment terms</dt>
                <dd>{invoice.paymentTerms ?? "Net 30"} · Manual processing</dd>
              </dl>
              {invoice.notes ? <p>{invoice.notes}</p> : null}
            </div>
          </ForgePageSection>
        </>
      ) : null}
    </CreatorPage>
  );
}

export default function BusinessInvoiceDetailPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <InvoiceDetailInner />
    </Suspense>
  );
}
