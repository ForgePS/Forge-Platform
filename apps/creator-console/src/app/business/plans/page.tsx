"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  commercialSend,
  unwrapItems,
  type CommercialPlan,
} from "@/lib/commercial-api";
import {
  BILLING_FREQUENCIES,
  billingFrequencyLabel,
  dollarsToCents,
  formatUsd,
  planStatusLabel,
} from "@/lib/commercial-format";
import styles from "../../page.module.css";

export default function BusinessPlansPage() {
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.plan.view") ||
    hasPermission("platform.billing.view") ||
    hasPermission("platform.entitlement.manage");
  const canManage = hasPermission("platform.plan.manage");

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [billingFrequency, setBillingFrequency] = useState("ANNUAL");
  const [basePrice, setBasePrice] = useState("");
  const [implementationFee, setImplementationFee] = useState("0");

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const result = await commercialGet<CommercialPlan[] | { items: CommercialPlan[] }>(
      COMMERCIAL_PATHS.plans,
    );
    if (result.status === "unavailable") {
      setUnavailable(true);
      setPlans([]);
    } else if (result.status === "error") {
      setError(result.message);
      setPlans([]);
    } else {
      setPlans(unwrapItems(result.data));
    }
    setLoading(false);
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setFormError(null);
    setFormSuccess(null);
    const basePriceCents = dollarsToCents(basePrice);
    const implementationFeeCents = dollarsToCents(implementationFee) ?? 0;
    if (basePriceCents == null) {
      setFormError("Enter a valid base price.");
      return;
    }
    setSaving(true);
    const result = await commercialSend(COMMERCIAL_PATHS.plans, "POST", {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      billingFrequency,
      basePriceCents,
      implementationFeeCents,
      currency: "USD",
      status: "DRAFT",
    });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setFormSuccess("Plan created.");
    setCode("");
    setName("");
    setBasePrice("");
    setImplementationFee("0");
    await load();
  }

  return (
    <CreatorPage
      title="Plans & Pricing"
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · Platform plan catalog"}
        </>
      }
      width="wide"
    >
      {!canView ? (
        <p className={styles.error}>Missing permission: platform.plan.view</p>
      ) : null}

      <ForgeToolbar
        actions={
          <button type="button" className="forge-btn forge-btn--secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {loading ? (
        <ForgePageSection title="Plans">
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

      {!loading && !unavailable && !error ? (
        <ForgePageSection title="Plans">
          {plans.length === 0 ? (
            <EmptyState
              title="No plans yet"
              description="Create a plan to define catalog pricing for commercial subscriptions."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Frequency</th>
                  <th>Base price</th>
                  <th>Implementation</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const version = plan.activeVersion;
                  return (
                    <tr key={plan.id}>
                      <td className={styles.mono}>{plan.code}</td>
                      <td>{plan.name}</td>
                      <td>
                        <ForgeStatusBadge
                          status={plan.status}
                          label={planStatusLabel(plan.status)}
                        />
                      </td>
                      <td>
                        {billingFrequencyLabel(
                          version?.billingFrequency ?? plan.billingFrequency,
                        )}
                      </td>
                      <td>
                        {formatUsd(version?.basePriceCents ?? plan.basePriceCents)}
                      </td>
                      <td>
                        {formatUsd(
                          version?.implementationFeeCents ?? plan.implementationFeeCents,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ForgePageSection>
      ) : null}

      {canManage && !unavailable ? (
        <ForgePageSection title="Create plan">
          {formError ? <p className={styles.error}>{formError}</p> : null}
          {formSuccess ? <p className={styles.success}>{formSuccess}</p> : null}
          <form className={styles.form} onSubmit={(e) => void onCreate(e)}>
            <div className={styles.formRow}>
              <label htmlFor="plan-code">Code</label>
              <input
                id="plan-code"
                className="forge-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="IND_STD"
                required
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="plan-name">Name</label>
              <input
                id="plan-name"
                className="forge-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="plan-freq">Billing frequency</label>
              <select
                id="plan-freq"
                className="forge-select"
                value={billingFrequency}
                onChange={(e) => setBillingFrequency(e.target.value)}
              >
                {BILLING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {billingFrequencyLabel(f)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <label htmlFor="plan-base">Base price (USD)</label>
              <input
                id="plan-base"
                className="forge-input"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="12000.00"
                required
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="plan-impl">Implementation fee (USD)</label>
              <input
                id="plan-impl"
                className="forge-input"
                value={implementationFee}
                onChange={(e) => setImplementationFee(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className={styles.actions}>
              <button type="submit" className="forge-btn forge-btn--primary" disabled={saving}>
                {saving ? "Creating…" : "Create plan"}
              </button>
            </div>
          </form>
        </ForgePageSection>
      ) : null}

      {!canManage && canView && !unavailable ? (
        <p className={styles.muted}>Plan creation requires platform.plan.manage.</p>
      ) : null}
    </CreatorPage>
  );
}
