"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import {
  onboardingActivate,
  onboardingCompleteStep,
  onboardingStart,
  type OnboardingSession,
} from "@/lib/api";
import styles from "../page.module.css";

function OnboardingInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("platform.onboarding.manage");

  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [customerType, setCustomerType] = useState("FIRE_DEPARTMENT");
  const [templateCode, setTemplateCode] = useState("starter-fire");
  const [stepPayload, setStepPayload] = useState('{"displayName":"Acme Fire"}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiMissing, setApiMissing] = useState(false);

  async function runStep(action: () => Promise<OnboardingSession>) {
    setLoading(true);
    setError(null);
    setApiMissing(false);
    try {
      setSession(await action());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Onboarding request failed";
      if (message.includes("404") || message.toLowerCase().includes("not found")) {
        setApiMissing(true);
        setError(
          "Onboarding API is not available yet (Wave 5). Expected endpoints under /api/v1/onboarding.",
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onStart(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    await runStep(() => {
      const payload: { customerType: string; templateCode?: string } = { customerType };
      if (templateCode.trim()) payload.templateCode = templateCode.trim();
      return onboardingStart(payload);
    });
  }

  async function onCompleteStep(event: FormEvent) {
    event.preventDefault();
    if (!session || !canManage) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(stepPayload) as Record<string, unknown>;
    } catch {
      setError("Step payload must be valid JSON");
      return;
    }
    await runStep(() => onboardingCompleteStep(session.id, session.currentStep, payload));
  }

  async function onActivate() {
    if (!session || !canManage) return;
    await runStep(() => onboardingActivate(session.id));
  }

  if (!tenantId) {
    return (
      <section className={styles.page}>
        <h1>Onboarding</h1>
        <TenantRequired />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1>Onboarding wizard</h1>
      <p className={styles.lead}>
        Scaffold for <code>/api/v1/onboarding</code> start, step completion, and activation.
      </p>

      {!canManage ? (
        <p className={styles.error}>Missing permission: platform.onboarding.manage</p>
      ) : null}
      {apiMissing ? (
        <div className={styles.error}>
          Onboarding API has not landed in platform-api yet. UI is wired and will work once Wave 5
          endpoints are deployed.
        </div>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.panel}>
        <h2>1. Start session</h2>
        <form className={styles.form} onSubmit={onStart}>
          <div className={styles.formRow}>
            <label htmlFor="customerType">Customer type</label>
            <input
              id="customerType"
              value={customerType}
              onChange={(event) => setCustomerType(event.target.value)}
              required
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="templateCode">Template code</label>
            <input
              id="templateCode"
              value={templateCode}
              onChange={(event) => setTemplateCode(event.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={loading || !canManage}>
              {loading ? "Starting…" : "Start onboarding"}
            </button>
          </div>
        </form>
      </div>

      {session ? (
        <>
          <div className={styles.panel}>
            <h2>Current session</h2>
            <dl className={styles.dl}>
              <dt>Session ID</dt>
              <dd className={styles.mono}>{session.id}</dd>
              <dt>Tenant ID</dt>
              <dd className={styles.mono}>{session.tenantId}</dd>
              <dt>Status</dt>
              <dd>{session.status}</dd>
              <dt>Current step</dt>
              <dd>{session.currentStep}</dd>
              <dt>Template</dt>
              <dd>{session.templateCode ?? "—"}</dd>
            </dl>
          </div>

          <div className={styles.panel}>
            <h2>2. Complete step {session.currentStep}</h2>
            <form className={styles.form} onSubmit={onCompleteStep}>
              <div className={styles.formRow}>
                <label htmlFor="stepPayload">Step payload (JSON)</label>
                <textarea
                  id="stepPayload"
                  rows={4}
                  value={stepPayload}
                  onChange={(event) => setStepPayload(event.target.value)}
                />
              </div>
              <div className={styles.actions}>
                <button className={styles.buttonSecondary} type="submit" disabled={loading || !canManage}>
                  {loading ? "Saving…" : "Complete step"}
                </button>
              </div>
            </form>
          </div>

          <div className={styles.panel}>
            <h2>3. Activate</h2>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                disabled={loading || !canManage}
                onClick={() => void onActivate()}
              >
                {loading ? "Activating…" : "Activate tenant"}
              </button>
              <Link href={tenantDetailHref(session.tenantId)}>Open tenant detail</Link>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <OnboardingInner />
    </Suspense>
  );
}
