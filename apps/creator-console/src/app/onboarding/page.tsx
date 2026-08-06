"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import {
  onboardingActivate,
  onboardingCompleteStep,
  onboardingListSessions,
  onboardingStart,
  toIfMatch,
  type OnboardingSessionView,
  type OnboardingStepRow,
} from "@/lib/api";
import styles from "../page.module.css";

const CUSTOMER_TYPES = ["FIRE_DEPARTMENT", "INDUSTRIAL", "FIRE_ACADEMY", "OTHER"] as const;

const STEP_LABELS: Record<string, string> = {
  CREATE_TENANT: "Create tenant",
  SELECT_CUSTOMER_TYPE: "Select customer type",
  CREATE_PRIMARY_ORGANIZATION: "Create primary organization",
  SELECT_PRODUCTS: "Select products",
  SELECT_MODULES: "Select modules",
  CONFIGURE_SUBSCRIPTION: "Configure subscription",
  CONFIGURE_BRANDING: "Configure branding",
  CREATE_PRIMARY_ADMINISTRATOR: "Create primary administrator",
  SEND_INVITATION: "Send invitation",
  REVIEW_CONFIGURATION: "Review configuration",
  ACTIVATE_TENANT: "Activate tenant",
};

function defaultPayloadForStep(
  stepKey: string,
  seed: { displayName: string; slug: string; customerType: string },
): string {
  switch (stepKey) {
    case "CREATE_PRIMARY_ORGANIZATION":
      return JSON.stringify(
        {
          slug: seed.slug,
          legalName: seed.displayName,
          displayName: seed.displayName,
          organizationTypeCode:
            seed.customerType === "OTHER" ? "FIRE_DEPARTMENT" : seed.customerType,
        },
        null,
        2,
      );
    case "SELECT_PRODUCTS":
      return JSON.stringify({ productCodes: ["FORGE_RMS"] }, null, 2);
    case "SELECT_MODULES":
      return JSON.stringify(
        { moduleCodes: ["CORE", "PERSONNEL", "NERIS"] },
        null,
        2,
      );
    case "CONFIGURE_SUBSCRIPTION":
      return JSON.stringify({ status: "TRIAL", periodDays: 30 }, null, 2);
    case "CONFIGURE_BRANDING":
      return JSON.stringify({ primaryColor: "#0B3D91", supportEmail: "admin@example.com" }, null, 2);
    case "CREATE_PRIMARY_ADMINISTRATOR":
      return JSON.stringify(
        {
          email: "admin@example.com",
          firstName: "Primary",
          lastName: "Admin",
        },
        null,
        2,
      );
    case "SEND_INVITATION":
      return JSON.stringify({ send: false, expiresInHours: 168 }, null, 2);
    case "REVIEW_CONFIGURATION":
      return JSON.stringify({ acknowledged: true }, null, 2);
    default:
      return "{}";
  }
}

function nextActionableStep(steps: OnboardingStepRow[]): OnboardingStepRow | null {
  const pending = steps
    .filter((s) => s.status === "PENDING" || s.status === "FAILED")
    .sort((a, b) => a.stepNumber - b.stepNumber);
  return (
    pending.find((s) => s.stepKey !== "ACTIVATE_TENANT") ??
    pending.find((s) => s.stepKey === "ACTIVATE_TENANT") ??
    null
  );
}

function OnboardingInner() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("platform.onboarding.manage");

  const [view, setView] = useState<OnboardingSessionView | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [customerType, setCustomerType] = useState<(typeof CUSTOMER_TYPES)[number]>("FIRE_DEPARTMENT");
  const [templateCode, setTemplateCode] = useState("RMS_STARTER");
  const [tenantKey, setTenantKey] = useState("");
  const [slug, setSlug] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [stepPayload, setStepPayload] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const session = view?.session ?? null;
  const steps = useMemo(() => view?.steps ?? [], [view]);
  const nextStep = useMemo(() => nextActionableStep(steps), [steps]);

  const applyView = useCallback(
    (next: OnboardingSessionView, nextEtag?: string) => {
      setView(next);
      setEtag(nextEtag ?? toIfMatch(next.session.recordVersion));
      const actionable = nextActionableStep(next.steps);
      if (actionable && actionable.stepKey !== "ACTIVATE_TENANT") {
        setStepPayload(
          defaultPayloadForStep(actionable.stepKey, {
            displayName: displayName.trim() || legalName.trim() || "New organization",
            slug: slug.trim() || tenantKey.trim() || "new-org",
            customerType: next.session.customerType || customerType,
          }),
        );
      }
    },
    [customerType, displayName, legalName, slug, tenantKey],
  );

  async function run<T>(action: () => Promise<T>, onOk?: (value: T) => void) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const value = await action();
      onOk?.(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding request failed");
    } finally {
      setLoading(false);
    }
  }

  async function onStart(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    await run(
      () => {
        const payload: {
          customerType: string;
          tenantKey: string;
          slug: string;
          legalName: string;
          displayName: string;
          timezone: string;
          templateCode?: string;
        } = {
          customerType,
          tenantKey: tenantKey.trim(),
          slug: slug.trim(),
          legalName: legalName.trim(),
          displayName: displayName.trim(),
          timezone: timezone.trim() || "America/Chicago",
        };
        if (templateCode.trim()) payload.templateCode = templateCode.trim();
        return onboardingStart(payload);
      },
      (result) => {
        applyView(result.data, result.etag);
        setMessage("Onboarding session started — tenant created in PENDING state.");
      },
    );
  }

  async function onCompleteStep(event: FormEvent) {
    event.preventDefault();
    if (!session || !canManage || !nextStep || !etag) return;
    if (nextStep.stepKey === "ACTIVATE_TENANT") {
      setError("Use Activate tenant for the final step.");
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(stepPayload) as Record<string, unknown>;
    } catch {
      setError("Step payload must be valid JSON");
      return;
    }
    await run(
      () =>
        onboardingCompleteStep(
          session.id,
          nextStep.stepKey,
          payload,
          etag,
          session.tenantId,
        ),
      (result) => {
        applyView(result.data, result.etag);
        setMessage(`Completed ${nextStep.stepKey}.`);
      },
    );
  }

  async function onActivate() {
    if (!session || !canManage || !etag) return;
    await run(
      () => onboardingActivate(session.id, etag, session.tenantId),
      (result) => {
        applyView(result.data, result.etag);
        setMessage("Tenant activated.");
      },
    );
  }

  async function onLoadRecent() {
    if (!canManage) return;
    await run(
      () => onboardingListSessions(),
      (rows) => {
        const latest = rows[0];
        if (!latest) {
          setMessage("No onboarding sessions found.");
          return;
        }
        applyView(latest, toIfMatch(latest.session.recordVersion));
        setMessage(`Loaded session ${latest.session.id}.`);
      },
    );
  }

  return (
    <section className={styles.page}>
      <h1>Onboarding wizard</h1>
      <p className={styles.lead}>
        Create a customer tenant through{" "}
        <code>/api/v1/platform/onboarding/sessions</code> (start → steps → activate).
      </p>

      {!canManage ? (
        <p className={styles.error}>Missing permission: platform.onboarding.manage</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.success}>{message}</p> : null}

      <div className={styles.panel}>
        <h2>1. Start session</h2>
        <p className={styles.muted}>
          Creates the tenant and an in-progress onboarding session. Steps 1–2 complete automatically.
        </p>
        <form className={styles.form} onSubmit={onStart}>
          <div className={styles.formRow}>
            <label htmlFor="customerType">Customer type</label>
            <select
              id="customerType"
              value={customerType}
              onChange={(event) => {
                const next = event.target.value as (typeof CUSTOMER_TYPES)[number];
                setCustomerType(next);
                if (next === "FIRE_DEPARTMENT") setTemplateCode("RMS_STARTER");
                else if (next === "INDUSTRIAL") setTemplateCode("INDUSTRIAL_STARTER");
                else if (next === "FIRE_ACADEMY") setTemplateCode("ACADEMY_STARTER");
                else setTemplateCode("");
              }}
            >
              {CUSTOMER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="templateCode">Template code</label>
            <input
              id="templateCode"
              value={templateCode}
              onChange={(event) => setTemplateCode(event.target.value)}
              placeholder="RMS_STARTER"
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="tenantKey">Tenant key</label>
            <input
              id="tenantKey"
              value={tenantKey}
              onChange={(event) => setTenantKey(event.target.value)}
              placeholder="acme-fire"
              required
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="acme-fire"
              required
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="legalName">Legal name</label>
            <input
              id="legalName"
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              required
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="timezone">Timezone</label>
            <input
              id="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={loading || !canManage}>
              {loading ? "Starting…" : "Start onboarding"}
            </button>
            <button
              className={styles.buttonSecondary}
              type="button"
              disabled={loading || !canManage}
              onClick={() => void onLoadRecent()}
            >
              Load latest session
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
              <dt>Current step #</dt>
              <dd>{session.currentStep}</dd>
              <dt>Customer type</dt>
              <dd>{session.customerType}</dd>
              <dt>Template</dt>
              <dd>{session.templateCode ?? view?.template?.code ?? "—"}</dd>
              <dt>Record version</dt>
              <dd className={styles.mono}>{session.recordVersion}</dd>
            </dl>
          </div>

          <div className={styles.panel}>
            <h2>Step progress</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Step</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {steps
                  .slice()
                  .sort((a, b) => a.stepNumber - b.stepNumber)
                  .map((step) => (
                    <tr key={step.id}>
                      <td>{step.stepNumber}</td>
                      <td>
                        {STEP_LABELS[step.stepKey] ?? step.stepKey}
                        {nextStep?.id === step.id ? " ← next" : ""}
                      </td>
                      <td>{step.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {nextStep && nextStep.stepKey !== "ACTIVATE_TENANT" ? (
            <div className={styles.panel}>
              <h2>
                2. Complete {STEP_LABELS[nextStep.stepKey] ?? nextStep.stepKey} (
                {nextStep.stepKey})
              </h2>
              <form className={styles.form} onSubmit={onCompleteStep}>
                <div className={styles.formRow}>
                  <label htmlFor="stepPayload">Step payload (JSON)</label>
                  <textarea
                    id="stepPayload"
                    rows={8}
                    value={stepPayload}
                    onChange={(event) => setStepPayload(event.target.value)}
                  />
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.buttonSecondary}
                    type="submit"
                    disabled={loading || !canManage || !etag}
                  >
                    {loading ? "Saving…" : "Complete step"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <div className={styles.panel}>
            <h2>3. Activate</h2>
            <p className={styles.muted}>
              Requires all prior steps completed. Uses optimistic concurrency (If-Match).
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                disabled={loading || !canManage || !etag || session.status === "COMPLETED"}
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
