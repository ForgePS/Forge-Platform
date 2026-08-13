"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { ForgePageSection } from "@forge/ui";
import { CreatorLoading, CreatorPage } from "@/components/creator-page";
import { useAuth } from "@/hooks/use-auth";
import { apiGet } from "@/lib/api";
import {
  clearSupportSession,
  getSupportSession,
  setSupportSession,
  type SupportSession,
} from "@/lib/support-session";
import styles from "../../page.module.css";

type Tenant = {
  id: string;
  displayName: string;
  legalName: string;
  tenantKey: string;
  status: string;
};

const PRODUCTS = ["Industrial", "RMS", "Academy"] as const;

function SupportSessionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId") ?? "";
  const { me, loading: authLoading } = useAuth();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [customerId, setCustomerId] = useState(preselectedCustomerId);
  const [product, setProduct] = useState<(typeof PRODUCTS)[number]>("Industrial");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<SupportSession | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenants(await apiGet<Tenant[]>("/api/v1/platform/tenants"));
    } catch {
      setError("We couldn't load customers right now. Try again in a moment.");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    setExisting(getSupportSession());
  }, [load]);

  useEffect(() => {
    if (preselectedCustomerId) setCustomerId(preselectedCustomerId);
  }, [preselectedCustomerId]);

  const isAdmin = Boolean(me?.isPlatformAdmin);

  function onStart(event: FormEvent) {
    event.preventDefault();
    if (!isAdmin || !me) return;
    const customer = tenants.find((t) => t.id === customerId);
    if (!customer) {
      setError("Select a customer to start a support session.");
      return;
    }
    if (!reason.trim()) {
      setError("Provide a short reason for the support session.");
      return;
    }
    setSupportSession({
      customerId: customer.id,
      customerName: customer.displayName,
      product,
      reason: reason.trim(),
      startedAt: new Date().toISOString(),
      startedBy: me.userId,
    });
    router.push("/support?session=started");
  }

  function onEnd() {
    clearSupportSession();
    setExisting(null);
  }

  if (authLoading || loading) {
    return <CreatorLoading label="Loading support session…" />;
  }

  if (!isAdmin) {
    return (
      <CreatorPage title="Support Session">
        <p className={styles.error}>
          Access denied. Only platform administrators can start support sessions.
        </p>
        <Link className="forge-btn forge-btn--secondary" href="/support">
          Back to Support
        </Link>
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Support Session"
      subtitle="Start a guided session so the shell banner shows which customer you are helping."
    >
      {existing ? (
        <p className={styles.success}>
          Active session: {existing.customerName} · {existing.product}.{" "}
          <button type="button" className="forge-btn forge-btn--outline" onClick={onEnd}>
            End Session
          </button>
        </p>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <ForgePageSection title="Start session">
        <form className={styles.form} onSubmit={onStart}>
          <div className={styles.formRow}>
            <label htmlFor="support-customer">Customer</label>
            <select
              id="support-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Select customer…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="support-product">Product</label>
            <select
              id="support-product"
              value={product}
              onChange={(e) => setProduct(e.target.value as (typeof PRODUCTS)[number])}
            >
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="support-reason">Reason</label>
            <textarea
              id="support-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Brief description of the support request"
              required
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className="forge-btn" disabled={!customerId || !reason.trim()}>
              Start Session
            </button>
            <Link className="forge-btn forge-btn--secondary" href="/support">
              Cancel
            </Link>
          </div>
        </form>
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function SupportSessionPage() {
  return (
    <Suspense fallback={<CreatorLoading label="Loading support session…" />}>
      <SupportSessionInner />
    </Suspense>
  );
}
