"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CreatorLoading,
  CreatorPage,
  EmptyState,
  ErrorState,
  ForgePageSection,
  ForgeSkeleton,
  ForgeToolbar,
} from "@/components/creator-page";
import { useAuth } from "@/hooks/use-auth";
import {
  COMMERCIAL_BACKEND_CONDITION,
  COMMERCIAL_PATHS,
  commercialGet,
  commercialSend,
  unwrapItems,
  type CommercialPaymentListItem,
} from "@/lib/commercial-api";
import {
  PAYMENT_METHODS,
  dollarsToCents,
  formatDate,
  formatUsd,
  paymentMethodLabel,
} from "@/lib/commercial-format";
import styles from "../../page.module.css";

function PaymentsInner() {
  const searchParams = useSearchParams();
  const tenantIdParam = searchParams.get("tenantId")?.trim() ?? "";
  const invoiceIdParam = searchParams.get("invoiceId")?.trim() ?? "";
  const subscriptionIdParam = searchParams.get("subscriptionId")?.trim() ?? "";

  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.payment.view") ||
    hasPermission("platform.billing.view") ||
    hasPermission("platform.entitlement.manage");
  const canRecord = hasPermission("platform.payment.record");

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialPaymentListItem[]>([]);

  const [tenantId, setTenantId] = useState(tenantIdParam);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("MANUAL");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceId, setInvoiceId] = useState(invoiceIdParam);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const path = tenantIdParam
      ? COMMERCIAL_PATHS.tenantPayments(tenantIdParam)
      : COMMERCIAL_PATHS.payments;
    const result = await commercialGet<
      CommercialPaymentListItem[] | { items: CommercialPaymentListItem[] }
    >(path, {
      query: {
        subscriptionId: subscriptionIdParam || undefined,
        invoiceId: invoiceIdParam || undefined,
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
  }, [canView, invoiceIdParam, subscriptionIdParam, tenantIdParam]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTenantId(tenantIdParam);
    setInvoiceId(invoiceIdParam);
  }, [invoiceIdParam, tenantIdParam]);

  async function onRecord(e: FormEvent) {
    e.preventDefault();
    if (!canRecord) return;
    setFormError(null);
    setFormSuccess(null);
    const amountCents = dollarsToCents(amount);
    if (!tenantId.trim()) {
      setFormError("Tenant ID is required.");
      return;
    }
    if (amountCents == null || amountCents <= 0) {
      setFormError("Enter a valid payment amount.");
      return;
    }
    const paymentDateIso = new Date(`${paymentDate}T12:00:00.000Z`).toISOString();
    setSaving(true);
    const allocations =
      invoiceId.trim() && amountCents > 0
        ? [{ invoiceId: invoiceId.trim(), amountCents }]
        : [];
    const result = await commercialSend(COMMERCIAL_PATHS.payments, "POST", {
      tenantId: tenantId.trim(),
      paymentDate: paymentDateIso,
      amountCents,
      currency: "USD",
      method,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      allocations,
    });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setFormSuccess("Payment recorded.");
    setAmount("");
    setReference("");
    setNotes("");
    await load();
  }

  return (
    <CreatorPage
      title="Payments"
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · Manual payment recording only"}
        </>
      }
      width="wide"
    >
      <div className={styles.panel} role="status">
        <strong>Payment Processing:</strong> Manual
        <p className={styles.muted} style={{ margin: "0.35rem 0 0" }}>
          Record payments after funds are received externally. Card charging and auto-pay are not
          available.
        </p>
      </div>

      {!canView ? (
        <p className={styles.error}>Missing permission: platform.payment.view</p>
      ) : null}

      <ForgeToolbar
        actions={
          <button type="button" className="forge-btn forge-btn--secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? (
        <ForgePageSection title="Payments">
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
        <ForgePageSection title="Payment history">
          {items.length === 0 ? (
            <EmptyState
              title="No payments recorded"
              description="Manual payments will appear here after they are recorded."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>{row.paymentNumber}</td>
                    <td>{row.tenantDisplayName ?? "—"}</td>
                    <td>{formatDate(row.paymentDate)}</td>
                    <td>{paymentMethodLabel(row.method)}</td>
                    <td>{formatUsd(row.amountCents)}</td>
                    <td>{row.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ForgePageSection>
      ) : null}

      {canRecord && !unavailable ? (
        <ForgePageSection title="Record manual payment">
          {formError ? <p className={styles.error}>{formError}</p> : null}
          {formSuccess ? <p className={styles.success}>{formSuccess}</p> : null}
          <form className={styles.form} onSubmit={(e) => void onRecord(e)}>
            <div className={styles.formRow}>
              <label htmlFor="pay-tenant">Tenant ID</label>
              <input
                id="pay-tenant"
                className="forge-input"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                required
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pay-date">Payment date</label>
              <input
                id="pay-date"
                type="date"
                className="forge-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pay-amount">Amount (USD)</label>
              <input
                id="pay-amount"
                className="forge-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000.00"
                required
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pay-method">Method</label>
              <select
                id="pay-method"
                className="forge-select"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pay-invoice">Allocate to invoice ID (optional)</label>
              <input
                id="pay-invoice"
                className="forge-input"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pay-ref">Reference</label>
              <input
                id="pay-ref"
                className="forge-input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="pay-notes">Notes</label>
              <textarea
                id="pay-notes"
                className="forge-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className={styles.actions}>
              <button type="submit" className="forge-btn forge-btn--primary" disabled={saving}>
                {saving ? "Recording…" : "Record payment"}
              </button>
            </div>
          </form>
        </ForgePageSection>
      ) : null}

      {!canRecord && canView && !unavailable ? (
        <p className={styles.muted}>Recording payments requires platform.payment.record.</p>
      ) : null}
    </CreatorPage>
  );
}

export default function BusinessPaymentsPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <PaymentsInner />
    </Suspense>
  );
}
