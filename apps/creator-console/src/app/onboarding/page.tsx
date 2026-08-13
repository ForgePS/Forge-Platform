"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import {
  CreatorLoading,
  CreatorPage,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";
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

const PRODUCT_OPTIONS = [
  { code: "FORGE_RMS", label: "Forge RMS" },
  { code: "FORGE_INDUSTRIAL", label: "Forge Industrial Safety" },
] as const;

const MODULE_OPTIONS = [
  { code: "CORE", label: "Core" },
  { code: "PERSONNEL", label: "Personnel" },
  { code: "NERIS", label: "NERIS" },
  { code: "INCIDENTS", label: "Incidents" },
  { code: "INSPECTIONS", label: "Inspections" },
  { code: "TRAINING", label: "Training" },
  { code: "LOTO", label: "Lockout/Tagout (LOTO)" },
] as const;

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

const WIZARD_STEPS = [
  { id: "company", label: "Company" },
  { id: "products", label: "Products" },
  { id: "plan", label: "Plan" },
  { id: "modules", label: "Modules" },
  { id: "locations", label: "Locations" },
  { id: "administrator", label: "Administrator" },
  { id: "webAddress", label: "Web Address" },
  { id: "branding", label: "Branding" },
  { id: "review", label: "Review" },
  { id: "provisioning", label: "Provisioning Result" },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

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

function stepDone(steps: OnboardingStepRow[], stepKey: string): boolean {
  const row = steps.find((s) => s.stepKey === stepKey);
  return row?.status === "COMPLETED";
}

function friendlyError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim();
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return "We couldn't load this information.";
    }
    return msg;
  }
  return "We couldn't complete this step.";
}

function OnboardingInner() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("platform.onboarding.manage");

  const [wizardIndex, setWizardIndex] = useState(0);
  const [view, setView] = useState<OnboardingSessionView | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [sessionList, setSessionList] = useState<OnboardingSessionView[] | null>(null);

  const [customerType, setCustomerType] = useState<(typeof CUSTOMER_TYPES)[number]>("FIRE_DEPARTMENT");
  const [templateCode, setTemplateCode] = useState("RMS_STARTER");
  const [tenantKey, setTenantKey] = useState("");
  const [slug, setSlug] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");

  const [productCodes, setProductCodes] = useState<string[]>(["FORGE_RMS"]);
  const [planStatus, setPlanStatus] = useState("TRIAL");
  const [periodDays, setPeriodDays] = useState(30);
  const [moduleCodes, setModuleCodes] = useState<string[]>(["CORE", "PERSONNEL", "NERIS"]);

  const [orgSlug, setOrgSlug] = useState("");
  const [orgLegalName, setOrgLegalName] = useState("");
  const [orgDisplayName, setOrgDisplayName] = useState("");
  const [orgTypeCode, setOrgTypeCode] = useState("FIRE_DEPARTMENT");

  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [webAddressAck, setWebAddressAck] = useState(false);

  const [primaryColor, setPrimaryColor] = useState("#0B3D91");
  const [supportEmail, setSupportEmail] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationDone, setActivationDone] = useState(false);

  const session = view?.session ?? null;
  const steps = useMemo(() => view?.steps ?? [], [view]);
  const wizardStep = WIZARD_STEPS[wizardIndex]?.id ?? "company";
  const hostname = `${(slug.trim() || tenantKey.trim() || "customer").toLowerCase()}.forgepublicsafety.com`;

  const applyView = useCallback((next: OnboardingSessionView, nextEtag?: string) => {
    setView(next);
    setEtag(nextEtag ?? toIfMatch(next.session.recordVersion));
    if (next.session.status === "COMPLETED") {
      setActivationDone(true);
      setWizardIndex(WIZARD_STEPS.length - 1);
    }
  }, []);

  const payloadForApiStep = useCallback(
    (stepKey: string): Record<string, unknown> | null => {
      switch (stepKey) {
        case "CREATE_PRIMARY_ORGANIZATION":
          return {
            slug: (orgSlug || slug).trim(),
            legalName: (orgLegalName || displayName || legalName).trim(),
            displayName: (orgDisplayName || displayName || legalName).trim(),
            organizationTypeCode:
              orgTypeCode.trim() ||
              (customerType === "OTHER" ? "FIRE_DEPARTMENT" : customerType),
          };
        case "SELECT_PRODUCTS":
          return { productCodes };
        case "SELECT_MODULES":
          return {
            moduleCodes: moduleCodes.map((code) =>
              code === "LOTO" ? "LOCKOUT_TAGOUT" : code,
            ),
          };
        case "CONFIGURE_SUBSCRIPTION":
          return { status: planStatus.trim() || "TRIAL", periodDays };
        case "CONFIGURE_BRANDING":
          return {
            primaryColor: primaryColor.trim() || "#0B3D91",
            supportEmail: supportEmail.trim() || undefined,
          };
        case "CREATE_PRIMARY_ADMINISTRATOR":
          return {
            email: adminEmail.trim(),
            firstName: adminFirstName.trim(),
            lastName: adminLastName.trim(),
          };
        case "SEND_INVITATION":
          return { send: false, expiresInHours: 168 };
        case "REVIEW_CONFIGURATION":
          return { acknowledged: true };
        default:
          return null;
      }
    },
    [
      adminEmail,
      adminFirstName,
      adminLastName,
      customerType,
      displayName,
      legalName,
      moduleCodes,
      orgDisplayName,
      orgLegalName,
      orgSlug,
      orgTypeCode,
      periodDays,
      planStatus,
      primaryColor,
      productCodes,
      slug,
      supportEmail,
    ],
  );

  const canCompleteApiStep = useCallback(
    (stepKey: string): boolean => {
      switch (stepKey) {
        case "CREATE_PRIMARY_ORGANIZATION":
          return Boolean(
            (orgSlug || slug).trim() &&
              (orgLegalName || displayName || legalName).trim() &&
              (orgDisplayName || displayName || legalName).trim(),
          );
        case "SELECT_PRODUCTS":
          return productCodes.length > 0;
        case "SELECT_MODULES":
          return moduleCodes.length > 0;
        case "CONFIGURE_SUBSCRIPTION":
          return Boolean(planStatus.trim()) && periodDays > 0;
        case "CONFIGURE_BRANDING":
          return Boolean(primaryColor.trim());
        case "CREATE_PRIMARY_ADMINISTRATOR":
          return Boolean(
            adminEmail.trim() && adminFirstName.trim() && adminLastName.trim(),
          );
        case "SEND_INVITATION":
        case "REVIEW_CONFIGURATION":
          return true;
        default:
          return false;
      }
    },
    [
      adminEmail,
      adminFirstName,
      adminLastName,
      displayName,
      legalName,
      moduleCodes,
      orgDisplayName,
      orgLegalName,
      orgSlug,
      periodDays,
      planStatus,
      primaryColor,
      productCodes,
      slug,
    ],
  );

  async function runCompleteReadySteps(
    currentView: OnboardingSessionView,
    currentEtag: string,
  ): Promise<{ view: OnboardingSessionView; etag: string }> {
    let working = currentView;
    let match = currentEtag;
    // Complete API steps in platform order whenever wizard data is ready.
    for (let guard = 0; guard < 12; guard += 1) {
      const next = nextActionableStep(working.steps);
      if (!next || next.stepKey === "ACTIVATE_TENANT") break;
      if (!canCompleteApiStep(next.stepKey)) break;
      const payload = payloadForApiStep(next.stepKey);
      if (!payload) break;
      const result = await onboardingCompleteStep(
        working.session.id,
        next.stepKey,
        payload,
        match,
        working.session.tenantId,
      );
      working = result.data;
      match = result.etag ?? toIfMatch(result.data.session.recordVersion);
    }
    return { view: working, etag: match };
  }

  function validateWizardStep(stepId: WizardStepId): Record<string, string> {
    const errors: Record<string, string> = {};
    if (stepId === "company") {
      if (!tenantKey.trim()) errors.tenantKey = "Tenant key is required.";
      if (!slug.trim()) errors.slug = "Slug is required.";
      if (!legalName.trim()) errors.legalName = "Legal name is required.";
      if (!displayName.trim()) errors.displayName = "Display name is required.";
    }
    if (stepId === "products" && productCodes.length === 0) {
      errors.products = "Select at least one product.";
    }
    if (stepId === "plan") {
      if (!planStatus.trim()) errors.planStatus = "Plan status is required.";
      if (!Number.isFinite(periodDays) || periodDays < 1) {
        errors.periodDays = "Period days must be at least 1.";
      }
    }
    if (stepId === "modules" && moduleCodes.length === 0) {
      errors.modules = "Select at least one module.";
    }
    if (stepId === "locations") {
      const s = (orgSlug || slug).trim();
      const ln = (orgLegalName || legalName || displayName).trim();
      const dn = (orgDisplayName || displayName || legalName).trim();
      if (!s) errors.orgSlug = "Organization slug is required.";
      if (!ln) errors.orgLegalName = "Organization legal name is required.";
      if (!dn) errors.orgDisplayName = "Organization display name is required.";
    }
    if (stepId === "administrator") {
      if (!adminEmail.trim() || !adminEmail.includes("@")) {
        errors.adminEmail = "A valid email is required.";
      }
      if (!adminFirstName.trim()) errors.adminFirstName = "First name is required.";
      if (!adminLastName.trim()) errors.adminLastName = "Last name is required.";
    }
    if (stepId === "webAddress" && !webAddressAck) {
      errors.webAddressAck = "Confirm the primary web address to continue.";
    }
    if (stepId === "branding") {
      if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColor.trim())) {
        errors.primaryColor = "Use a hex color like #0B3D91.";
      }
    }
    return errors;
  }

  async function onStartCompany() {
    if (!canManage) return;
    const errors = validateWizardStep("company");
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
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
      const result = await onboardingStart(payload);
      applyView(result.data, result.etag);
      setOrgSlug((v) => v || slug.trim());
      setOrgLegalName((v) => v || displayName.trim() || legalName.trim());
      setOrgDisplayName((v) => v || displayName.trim() || legalName.trim());
      setOrgTypeCode(customerType === "OTHER" ? "FIRE_DEPARTMENT" : customerType);
      setWizardIndex(1);
      setMessage("Onboarding session started.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function goNext() {
    if (!canManage) return;
    const stepId = wizardStep;
    const errors = validateWizardStep(stepId);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (stepId === "company") {
      if (!session) {
        await onStartCompany();
        return;
      }
      setWizardIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
      return;
    }

    if (stepId === "provisioning") return;

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      // Flush any API steps whose payloads are already collected (platform order).
      if (session && etag && view && stepId !== "webAddress") {
        const flushed = await runCompleteReadySteps(view, etag);
        applyView(flushed.view, flushed.etag);
      }
      setWizardIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onActivateTenant() {
    if (!session || !canManage || !etag) return;
    setActivating(true);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      let working = view!;
      let match = etag;
      const flushed = await runCompleteReadySteps(working, match);
      working = flushed.view;
      match = flushed.etag;
      const result = await onboardingActivate(working.session.id, match, working.session.tenantId);
      applyView(result.data, result.etag);
      setActivationDone(true);
      setMessage("Customer ready.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setActivating(false);
      setLoading(false);
    }
  }

  async function onLoadSessions() {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await onboardingListSessions();
      setSessionList(rows);
      const latest = rows[0];
      if (!latest) {
        setMessage("No onboarding sessions found.");
        return;
      }
      applyView(latest, toIfMatch(latest.session.recordVersion));
      setMessage(`Loaded session ${latest.session.id}.`);
      setWizardIndex(latest.session.status === "COMPLETED" ? WIZARD_STEPS.length - 1 : 1);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleCode(
    list: string[],
    code: string,
    setter: (next: string[]) => void,
  ) {
    setter(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  }

  function goBack() {
    setFieldErrors({});
    setError(null);
    setWizardIndex((i) => Math.max(0, i - 1));
  }

  const provisioningChecks = [
    { key: "CREATE_PRIMARY_ORGANIZATION", label: "Primary organization" },
    { key: "SELECT_PRODUCTS", label: "Products" },
    { key: "SELECT_MODULES", label: "Modules" },
    { key: "CONFIGURE_SUBSCRIPTION", label: "Subscription" },
    { key: "CONFIGURE_BRANDING", label: "Branding" },
    { key: "CREATE_PRIMARY_ADMINISTRATOR", label: "Administrator" },
    { key: "SEND_INVITATION", label: "Invitation prepared" },
    { key: "REVIEW_CONFIGURATION", label: "Configuration reviewed" },
    { key: "ACTIVATE_TENANT", label: "Tenant activated" },
  ];

  return (
    <CreatorPage
      title="Customer onboarding"
      subtitle="Guided wizard to create a customer tenant (start → configure → activate)."
      width="wide"
    >
      {!canManage ? (
        <p className={styles.error}>Missing permission: platform.onboarding.manage</p>
      ) : null}
      {error ? (
        <div>
          <p className={styles.error}>{error}</p>
          <button className={styles.buttonSecondary} type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {message ? <p className={styles.success}>{message}</p> : null}

      <ol className={styles.stepper} aria-label="Onboarding progress">
        {WIZARD_STEPS.map((step, index) => {
          const done = index < wizardIndex;
          const current = index === wizardIndex;
          return (
            <li
              key={step.id}
              className={`${styles.stepperItem} ${done ? styles.stepperItemDone : ""} ${current ? styles.stepperItemCurrent : ""}`}
            >
              <span className={styles.stepIndex}>{done ? "✓" : index + 1}</span>
              {step.label}
            </li>
          );
        })}
      </ol>

      {session ? (
        <ForgePageSection title="Current session">
          <dl className={styles.dl}>
            <dt>Status</dt>
            <dd>
              <ForgeStatusBadge status={session.status} />
            </dd>
            <dt>Customer type</dt>
            <dd>{session.customerType}</dd>
            <dt>Template</dt>
            <dd>{session.templateCode ?? view?.template?.code ?? "—"}</dd>
          </dl>
        </ForgePageSection>
      ) : null}

      {wizardStep === "company" ? (
        <ForgePageSection title="1. Company" description="Creates the tenant and onboarding session.">
          <div className={styles.form}>
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
                onChange={(e) => setTemplateCode(e.target.value)}
                placeholder="RMS_STARTER"
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="tenantKey">Tenant key</label>
              <input
                id="tenantKey"
                value={tenantKey}
                onChange={(e) => setTenantKey(e.target.value)}
                placeholder="acme-fire"
              />
              {fieldErrors.tenantKey ? <p className={styles.fieldError}>{fieldErrors.tenantKey}</p> : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="slug">Slug</label>
              <input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-fire"
              />
              {fieldErrors.slug ? <p className={styles.fieldError}>{fieldErrors.slug}</p> : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="legalName">Legal name</label>
              <input
                id="legalName"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
              {fieldErrors.legalName ? <p className={styles.fieldError}>{fieldErrors.legalName}</p> : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="displayName">Customer name</label>
              <input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              {fieldErrors.displayName ? (
                <p className={styles.fieldError}>{fieldErrors.displayName}</p>
              ) : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="timezone">Timezone</label>
              <input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
          </div>
        </ForgePageSection>
      ) : null}

      {wizardStep === "products" ? (
        <ForgePageSection title="2. Products" description="Maps to SELECT_PRODUCTS.">
          <div className={styles.checkboxGrid}>
            {PRODUCT_OPTIONS.map((opt) => (
              <label key={opt.code} className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={productCodes.includes(opt.code)}
                  onChange={() => toggleCode(productCodes, opt.code, setProductCodes)}
                />
                {opt.label}
                <span className={styles.muted}>({opt.code})</span>
              </label>
            ))}
          </div>
          {fieldErrors.products ? <p className={styles.fieldError}>{fieldErrors.products}</p> : null}
        </ForgePageSection>
      ) : null}

      {wizardStep === "plan" ? (
        <ForgePageSection title="3. Plan" description="Maps to CONFIGURE_SUBSCRIPTION.">
          <div className={styles.form}>
            <div className={styles.formRow}>
              <label htmlFor="planStatus">Status</label>
              <input
                id="planStatus"
                value={planStatus}
                onChange={(e) => setPlanStatus(e.target.value)}
                placeholder="TRIAL"
              />
              {fieldErrors.planStatus ? (
                <p className={styles.fieldError}>{fieldErrors.planStatus}</p>
              ) : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="periodDays">Period days</label>
              <input
                id="periodDays"
                type="number"
                min={1}
                value={periodDays}
                onChange={(e) => setPeriodDays(Number(e.target.value))}
              />
              {fieldErrors.periodDays ? (
                <p className={styles.fieldError}>{fieldErrors.periodDays}</p>
              ) : null}
            </div>
          </div>
        </ForgePageSection>
      ) : null}

      {wizardStep === "modules" ? (
        <ForgePageSection title="4. Modules" description="Maps to SELECT_MODULES.">
          <div className={styles.checkboxGrid}>
            {MODULE_OPTIONS.map((opt) => (
              <label key={opt.code} className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={moduleCodes.includes(opt.code)}
                  onChange={() => toggleCode(moduleCodes, opt.code, setModuleCodes)}
                />
                {opt.label}
                <span className={styles.muted}>({opt.code})</span>
              </label>
            ))}
          </div>
          {fieldErrors.modules ? <p className={styles.fieldError}>{fieldErrors.modules}</p> : null}
        </ForgePageSection>
      ) : null}

      {wizardStep === "locations" ? (
        <ForgePageSection
          title="5. Locations"
          description="Maps to CREATE_PRIMARY_ORGANIZATION."
        >
          <div className={styles.form}>
            <div className={styles.formRow}>
              <label htmlFor="orgSlug">Organization slug</label>
              <input
                id="orgSlug"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
              />
              {fieldErrors.orgSlug ? <p className={styles.fieldError}>{fieldErrors.orgSlug}</p> : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="orgLegalName">Legal name</label>
              <input
                id="orgLegalName"
                value={orgLegalName}
                onChange={(e) => setOrgLegalName(e.target.value)}
              />
              {fieldErrors.orgLegalName ? (
                <p className={styles.fieldError}>{fieldErrors.orgLegalName}</p>
              ) : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="orgDisplayName">Display name</label>
              <input
                id="orgDisplayName"
                value={orgDisplayName}
                onChange={(e) => setOrgDisplayName(e.target.value)}
              />
              {fieldErrors.orgDisplayName ? (
                <p className={styles.fieldError}>{fieldErrors.orgDisplayName}</p>
              ) : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="orgTypeCode">Organization type</label>
              <input
                id="orgTypeCode"
                value={orgTypeCode}
                onChange={(e) => setOrgTypeCode(e.target.value)}
              />
            </div>
          </div>
        </ForgePageSection>
      ) : null}

      {wizardStep === "administrator" ? (
        <ForgePageSection
          title="6. Administrator"
          description="Maps to CREATE_PRIMARY_ADMINISTRATOR."
        >
          <div className={styles.form}>
            <div className={styles.formRow}>
              <label htmlFor="adminEmail">Email</label>
              <input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
              {fieldErrors.adminEmail ? (
                <p className={styles.fieldError}>{fieldErrors.adminEmail}</p>
              ) : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="adminFirstName">First name</label>
              <input
                id="adminFirstName"
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
              />
              {fieldErrors.adminFirstName ? (
                <p className={styles.fieldError}>{fieldErrors.adminFirstName}</p>
              ) : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="adminLastName">Last name</label>
              <input
                id="adminLastName"
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
              />
              {fieldErrors.adminLastName ? (
                <p className={styles.fieldError}>{fieldErrors.adminLastName}</p>
              ) : null}
            </div>
          </div>
        </ForgePageSection>
      ) : null}

      {wizardStep === "webAddress" ? (
        <ForgePageSection
          title="7. Web Address"
          description="Confirm the primary customer hostname before branding."
        >
          <dl className={styles.dl}>
            <dt>Primary web address</dt>
            <dd className={styles.mono}>{hostname}</dd>
          </dl>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={webAddressAck}
              onChange={(e) => setWebAddressAck(e.target.checked)}
            />
            I confirm this web address for the customer
          </label>
          {fieldErrors.webAddressAck ? (
            <p className={styles.fieldError}>{fieldErrors.webAddressAck}</p>
          ) : null}
          <p className={styles.muted}>
            Acknowledgement is stored for review; DNS is managed by Forge operations.
          </p>
        </ForgePageSection>
      ) : null}

      {wizardStep === "branding" ? (
        <ForgePageSection title="8. Branding" description="Maps to CONFIGURE_BRANDING.">
          <div className={styles.form}>
            <div className={styles.formRow}>
              <label htmlFor="primaryColor">Primary color</label>
              <input
                id="primaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#0B3D91"
              />
              {fieldErrors.primaryColor ? (
                <p className={styles.fieldError}>{fieldErrors.primaryColor}</p>
              ) : null}
            </div>
            <div className={styles.formRow}>
              <label htmlFor="supportEmail">Support email</label>
              <input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
          </div>
        </ForgePageSection>
      ) : null}

      {wizardStep === "review" ? (
        <ForgePageSection
          title="9. Review"
          description="Read-only summary. Completes SEND_INVITATION (send: false) and REVIEW_CONFIGURATION."
        >
          <dl className={styles.dl}>
            <dt>Customer</dt>
            <dd>{displayName || legalName}</dd>
            <dt>Type</dt>
            <dd>{customerType}</dd>
            <dt>Web address</dt>
            <dd className={styles.mono}>{hostname}</dd>
            <dt>Products</dt>
            <dd>{productCodes.join(", ") || "—"}</dd>
            <dt>Modules</dt>
            <dd>{moduleCodes.join(", ") || "—"}</dd>
            <dt>Plan</dt>
            <dd>
              {planStatus} · {periodDays} days
            </dd>
            <dt>Organization</dt>
            <dd>
              {orgDisplayName || displayName} ({orgSlug || slug})
            </dd>
            <dt>Administrator</dt>
            <dd>
              {adminFirstName} {adminLastName} · {adminEmail}
            </dd>
            <dt>Branding</dt>
            <dd>
              {primaryColor}
              {supportEmail ? ` · ${supportEmail}` : ""}
            </dd>
          </dl>
        </ForgePageSection>
      ) : null}

      {wizardStep === "provisioning" ? (
        <ForgePageSection title="10. Provisioning Result">
          <ul className={styles.checklist}>
            {provisioningChecks.map((item) => {
              const done =
                item.key === "ACTIVATE_TENANT"
                  ? activationDone || session?.status === "COMPLETED"
                  : stepDone(steps, item.key);
              return (
                <li
                  key={item.key}
                  className={`${styles.checklistItem} ${done ? styles.checklistItemDone : ""}`}
                >
                  <span>{done ? "✓" : "○"}</span>
                  {item.label}
                  <span className={styles.muted}>
                    ({STEP_LABELS[item.key] ?? item.key})
                  </span>
                </li>
              );
            })}
          </ul>

          {!activationDone && session?.status !== "COMPLETED" ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                disabled={loading || !canManage || !etag || activating}
                onClick={() => void onActivateTenant()}
              >
                {activating ? "Activating…" : "Activate tenant"}
              </button>
            </div>
          ) : (
            <div className={styles.success}>
              <p style={{ margin: "0 0 0.75rem" }}>Customer Ready</p>
              {session ? (
                <Link className="forge-btn" href={tenantDetailHref(session.tenantId)}>
                  Open Customer
                </Link>
              ) : null}
            </div>
          )}
        </ForgePageSection>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.buttonSecondary}
          disabled={loading || wizardIndex === 0}
          onClick={goBack}
        >
          Back
        </button>
        {wizardStep !== "provisioning" ? (
          <button
            type="button"
            className={styles.button}
            disabled={loading || !canManage}
            onClick={() => void goNext()}
          >
            {loading
              ? "Working…"
              : wizardStep === "company" && !session
                ? "Start & Next"
                : "Next"}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.buttonSecondary}
          disabled={loading || !canManage}
          onClick={() => void onLoadSessions()}
        >
          Load latest session
        </button>
      </div>

      {sessionList && sessionList.length > 0 ? (
        <ForgePageSection title="Recent sessions">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Step</th>
                <th>Session</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessionList.slice(0, 8).map((row) => (
                <tr key={row.session.id}>
                  <td>
                    <ForgeStatusBadge status={row.session.status} />
                  </td>
                  <td>{row.session.customerType}</td>
                  <td>{row.session.currentStep}</td>
                  <td className={styles.mono}>{row.session.id}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => {
                        applyView(row, toIfMatch(row.session.recordVersion));
                        setWizardIndex(
                          row.session.status === "COMPLETED" ? WIZARD_STEPS.length - 1 : 1,
                        );
                      }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ForgePageSection>
      ) : null}
    </CreatorPage>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <OnboardingInner />
    </Suspense>
  );
}
