"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet, apiSend, toIfMatch } from "@/lib/api";
import styles from "../page.module.css";

type Overview = {
  customer: {
    id: string;
    displayName: string;
    billingEmail: string | null;
    recordVersion: number;
  } | null;
  subscription: {
    id: string;
    status: string;
    planCode: string | null;
    planName: string | null;
    billingInterval: string | null;
    billingType?: string;
  } | null;
  contracts: Array<{
    id: string;
    name: string;
    status: string;
    billingType: string;
    startsOn: string | null;
    endsOn: string | null;
    renewalOn: string | null;
    setupFeeCents: number | null;
    notes: string | null;
    pricingJson: {
      overrideAmountCents?: number;
      currency?: string;
      modules?: Array<{ moduleCode: string; amountCents: number }>;
    };
    recordVersion: number;
  }>;
  invoices: Array<{
    id: string;
    status: string;
    amountDueCents: number;
    amountPaidCents: number;
    currency: string;
    hostedInvoiceUrl: string | null;
    createdAt: string;
  }>;
  entitlements: {
    products: Array<{ productCode: string; productName: string; status: string }>;
    modules: Array<{ moduleCode: string; moduleName: string; status: string }>;
  };
  paymentPortal: { available: boolean; url: string | null; message: string };
};

function BillingInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("platform.entitlement.manage");
  const canRead = canManage || hasPermission("tenant.billing.read");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [contactEmail, setContactEmail] = useState("");
  const [contractName, setContractName] = useState("Enterprise agreement");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [renewalOn, setRenewalOn] = useState("");
  const [setupFeeCents, setSetupFeeCents] = useState("0");
  const [notes, setNotes] = useState("");
  const [overrideCents, setOverrideCents] = useState("");
  const [modulePricing, setModulePricing] = useState("");

  const load = useCallback(async () => {
    if (!tenantId || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Overview>(`/api/v1/tenants/${tenantId}/billing/overview`);
      setOverview(data);
      setContactEmail(data.customer?.billingEmail ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [tenantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveContact(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !canManage) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await apiSend(
        `/api/v1/tenants/${tenantId}/billing/customers`,
        "POST",
        { billingEmail: contactEmail || null },
      );
      if (overview?.customer) {
        await apiSend(
          `/api/v1/tenants/${tenantId}/billing/customers`,
          "PATCH",
          { billingEmail: contactEmail || null },
          { ifMatch: toIfMatch(overview.customer.recordVersion) },
        );
      }
      setMessage("Billing contact saved (audited).");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setSubmitting(false);
    }
  }

  async function createContract(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !canManage) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const modules = modulePricing
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [moduleCode, amount] = line.split(/[,=:]/).map((p) => p.trim());
          return {
            moduleCode: moduleCode || "",
            amountCents: Number(amount || 0),
          };
        })
        .filter((row) => row.moduleCode);

      await apiSend(`/api/v1/tenants/${tenantId}/billing/contracts`, "POST", {
        name: contractName,
        status: "ACTIVE",
        billingType: "MANUAL_ENTERPRISE_CONTRACT",
        startsOn: startsOn || null,
        endsOn: endsOn || null,
        renewalOn: renewalOn || null,
        setupFeeCents: Number(setupFeeCents || 0),
        notes: notes || null,
        pricingJson: {
          ...(overrideCents ? { overrideAmountCents: Number(overrideCents) } : {}),
          currency: "USD",
          ...(modules.length ? { modules } : {}),
        },
      });
      setMessage("Manual contract created (audited).");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contract");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenantId) {
    return (
      <section className={styles.page}>
        <h1>Billing</h1>
        <TenantRequired />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1>Billing</h1>
      <p className={styles.lead}>
        Tenant commercial overview · <span className={styles.mono}>{tenantId}</span> ·{" "}
        <Link href={`/subscriptions${tenantQuery(tenantId)}`}>Subscriptions</Link> ·{" "}
        <Link href={`/entitlements${tenantQuery(tenantId)}`}>Entitlements</Link> ·{" "}
        <Link href={`/audit${tenantQuery(tenantId)}`}>Audit</Link>
      </p>

      {!canRead ? (
        <p className={styles.error}>
          Missing permission: platform.entitlement.manage or tenant.billing.read
        </p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.muted}>{message}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {overview ? (
        <>
          <div className={styles.panel}>
            <h2>Overview</h2>
            <dl className={styles.dl}>
              <dt>Subscription status</dt>
              <dd>{overview.subscription?.status ?? "None"}</dd>
              <dt>Current plan</dt>
              <dd>
                {overview.subscription?.planName ?? overview.subscription?.planCode ?? "—"}
                {overview.subscription?.billingInterval
                  ? ` · ${overview.subscription.billingInterval}`
                  : ""}
              </dd>
              <dt>Billing contact</dt>
              <dd>{overview.customer?.billingEmail ?? "—"}</dd>
              <dt>Payment portal</dt>
              <dd>
                {overview.paymentPortal.available && overview.paymentPortal.url ? (
                  <a href={overview.paymentPortal.url} target="_blank" rel="noreferrer">
                    Open portal / invoice
                  </a>
                ) : (
                  overview.paymentPortal.message
                )}
              </dd>
            </dl>
          </div>

          <div className={styles.panel}>
            <h2>Products & modules</h2>
            <p className={styles.muted}>
              Products:{" "}
              {overview.entitlements.products
                .map((p) => `${p.productCode} (${p.status})`)
                .join(", ") || "None"}
            </p>
            <p className={styles.muted}>
              Modules:{" "}
              {overview.entitlements.modules
                .map((m) => `${m.moduleCode} (${m.status})`)
                .join(", ") || "None"}
            </p>
          </div>

          <div className={styles.panel}>
            <h2>Invoice history</h2>
            {overview.invoices.length === 0 ? (
              <p className={styles.muted}>No invoices recorded.</p>
            ) : (
              <ul>
                {overview.invoices.map((inv) => (
                  <li key={inv.id}>
                    {inv.status} · {(inv.amountDueCents / 100).toFixed(2)} {inv.currency}
                    {inv.hostedInvoiceUrl ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                          link
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.panel}>
            <h2>Contracts</h2>
            {overview.contracts.length === 0 ? (
              <p className={styles.muted}>No contracts yet.</p>
            ) : (
              <ul>
                {overview.contracts.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong> · {c.status} · {c.billingType}
                    {c.renewalOn ? ` · renews ${c.renewalOn}` : ""}
                    {c.setupFeeCents != null ? ` · setup $${(c.setupFeeCents / 100).toFixed(2)}` : ""}
                    {c.pricingJson?.overrideAmountCents != null
                      ? ` · override $${(c.pricingJson.overrideAmountCents / 100).toFixed(2)}`
                      : ""}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canManage ? (
            <>
              <div className={styles.panel}>
                <h2>Billing contact</h2>
                <form onSubmit={saveContact} className={styles.form}>
                  <label>
                    Email
                    <input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      type="email"
                    />
                  </label>
                  <button type="submit" disabled={submitting}>
                    Save contact
                  </button>
                </form>
              </div>

              <div className={styles.panel}>
                <h2>Manual enterprise contract</h2>
                <form onSubmit={createContract} className={styles.form}>
                  <label>
                    Name
                    <input value={contractName} onChange={(e) => setContractName(e.target.value)} required />
                  </label>
                  <label>
                    Starts on
                    <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
                  </label>
                  <label>
                    Ends on
                    <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
                  </label>
                  <label>
                    Renewal date
                    <input type="date" value={renewalOn} onChange={(e) => setRenewalOn(e.target.value)} />
                  </label>
                  <label>
                    Setup fee (cents)
                    <input value={setupFeeCents} onChange={(e) => setSetupFeeCents(e.target.value)} />
                  </label>
                  <label>
                    Pricing override (cents)
                    <input
                      value={overrideCents}
                      onChange={(e) => setOverrideCents(e.target.value)}
                      placeholder="optional"
                    />
                  </label>
                  <label>
                    Module pricing (one per line: CODE,cents)
                    <textarea
                      value={modulePricing}
                      onChange={(e) => setModulePricing(e.target.value)}
                      rows={3}
                      placeholder="LOTO,1500"
                    />
                  </label>
                  <label>
                    Notes
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </label>
                  <button type="submit" disabled={submitting}>
                    Create contract
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<section className={styles.page}><p>Loading…</p></section>}>
      <BillingInner />
    </Suspense>
  );
}
