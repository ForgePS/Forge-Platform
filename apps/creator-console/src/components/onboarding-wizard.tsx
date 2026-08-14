"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ForgeAssetUploader,
  ForgePageHeader,
  ForgeStepper,
  FormField,
  FormSection,
  StatusBadge,
  useToast,
} from "@forge/ui";
import { catalogModulesForSeed } from "@forge/contracts";
import {
  apiSend,
  humanizeForgeError,
  onboardingActivate,
  onboardingCompleteStep,
  onboardingGetSession,
  onboardingStart,
  toIfMatch,
  type OnboardingSessionView,
  type OnboardingStepRow,
} from "@/lib/api";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import { productDisplayName } from "@/lib/presentation";
import styles from "../app/page.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

type LocationDraft = {
  name: string;
  facilityType: string;
  addressLine1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  timezone: string;
};

type LookupDraft = { name: string };

const COMPANY_TYPES = [
  { value: "INDUSTRIAL", label: "Industrial / Manufacturing", template: "INDUSTRIAL_STARTER" },
  { value: "FIRE_DEPARTMENT", label: "Fire Department", template: "RMS_STARTER" },
  { value: "FIRE_ACADEMY", label: "Fire Academy", template: "ACADEMY_STARTER" },
  { value: "OTHER", label: "Other", template: undefined },
] as const;

const BUSINESS_ROLES: Array<{ label: string; match: RegExp }> = [
  { label: "Company Administrator", match: /ADMIN|TENANT_ADMIN|DEPARTMENT_ADMIN/i },
  { label: "Safety Administrator", match: /SAFETY/i },
  { label: "HR Administrator", match: /HR|PERSONNEL/i },
  { label: "Training Administrator", match: /TRAINING/i },
  { label: "Read Only", match: /EMPLOYEE|MEMBER|READ/i },
];

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

function stepLabel(key: string): string {
  const map: Record<string, string> = {
    CREATE_TENANT: "Company",
    SELECT_CUSTOMER_TYPE: "Company type",
    CREATE_PRIMARY_ORGANIZATION: "Organization",
    SELECT_PRODUCTS: "Products",
    SELECT_MODULES: "Modules",
    CONFIGURE_SUBSCRIPTION: "Subscription",
    CONFIGURE_LOCATIONS: "Locations",
    CONFIGURE_ORG_LOOKUPS: "Departments & positions",
    CONFIGURE_BRANDING: "Branding",
    CREATE_PRIMARY_ADMINISTRATOR: "Administrators",
    SEND_INVITATION: "Invitations",
    REVIEW_CONFIGURATION: "Review",
    ACTIVATE_TENANT: "Activate",
  };
  return map[key] ?? key.replace(/_/g, " ").toLowerCase();
}

function pendingSteps(steps: OnboardingStepRow[]): OnboardingStepRow[] {
  return steps.filter(
    (s) =>
      s.stepKey !== "CREATE_TENANT" &&
      s.stepKey !== "SELECT_CUSTOMER_TYPE" &&
      s.stepKey !== "ACTIVATE_TENANT" &&
      s.status !== "SKIPPED",
  );
}

export function OnboardingWizard({
  initialSessionId,
}: {
  initialSessionId?: string | undefined;
}) {
  const toast = useToast();
  const [view, setView] = useState<OnboardingSessionView | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [phase, setPhase] = useState<"start" | "wizard" | "success">("start");
  const [activeStepKey, setActiveStepKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start form
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [customerType, setCustomerType] = useState<(typeof COMPANY_TYPES)[number]["value"]>("INDUSTRIAL");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  // Step forms
  const [orgDisplayName, setOrgDisplayName] = useState("");
  const [orgLegalName, setOrgLegalName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [waiveSubscription, setWaiveSubscription] = useState(true);
  const [locations, setLocations] = useState<LocationDraft[]>([
    {
      name: "Primary location",
      facilityType: "SITE",
      addressLine1: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      timezone: "America/Chicago",
    },
  ]);
  const [departments, setDepartments] = useState<LookupDraft[]>([{ name: "Operations" }]);
  const [positions, setPositions] = useState<LookupDraft[]>([{ name: "Supervisor" }]);
  const [primaryColor, setPrimaryColor] = useState("#1a365d");
  const [secondaryColor, setSecondaryColor] = useState("#2d3748");
  const [supportEmail, setSupportEmail] = useState("");
  const [logoDocumentId, setLogoDocumentId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [adminFirst, setAdminFirst] = useState("");
  const [adminLast, setAdminLast] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRoleCode, setAdminRoleCode] = useState("");
  const [sendInviteNow, setSendInviteNow] = useState(true);
  const [activatedTenantId, setActivatedTenantId] = useState<string | null>(null);

  const catalogProducts = useMemo(
    () => [
      {
        code: "FORGE_INDUSTRIAL",
        name: "Forge Industrial Safety",
        description: "Safety, compliance, and operations for industrial companies.",
      },
      {
        code: "FORGE_RMS",
        name: "Forge RMS",
        description: "Records management for fire and emergency services.",
      },
      {
        code: "FORGE_ACADEMY",
        name: "Forge Academy",
        description: "Training academy administration and coursework.",
      },
    ],
    [],
  );

  useEffect(() => {
    if (!slugTouched && displayName) setSlug(normalizeSlug(displayName));
  }, [displayName, slugTouched]);

  const applyView = useCallback((next: OnboardingSessionView, nextEtag?: string) => {
    setView(next);
    if (nextEtag) setEtag(nextEtag);
    else setEtag(toIfMatch(next.session.recordVersion));
    const open = pendingSteps(next.steps).find((s) => s.status !== "COMPLETED");
    setActiveStepKey(open?.stepKey ?? "REVIEW_CONFIGURATION");
    setPhase(next.session.status === "COMPLETED" ? "success" : "wizard");
    setActivatedTenantId(next.session.tenantId);
    const data = next.session.sessionDataJson ?? {};
    if (Array.isArray(data.productCodes)) setSelectedProducts(data.productCodes as string[]);
    if (Array.isArray(data.moduleCodes)) setSelectedModules(data.moduleCodes as string[]);
    if (typeof data.adminEmail === "string") setAdminEmail(data.adminEmail);
    if (typeof data.adminFirstName === "string") setAdminFirst(data.adminFirstName);
    if (typeof data.adminLastName === "string") setAdminLast(data.adminLastName);
    if (typeof data.adminRoleCode === "string") setAdminRoleCode(data.adminRoleCode);
  }, []);

  useEffect(() => {
    if (!initialSessionId) return;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const result = await onboardingGetSession(initialSessionId);
        applyView(result.data, result.etag);
      } catch (err) {
        setError(humanizeForgeError(err instanceof Error ? err.message : "Could not load onboarding."));
      } finally {
        setBusy(false);
      }
    })();
  }, [initialSessionId, applyView]);

  const wizardSteps = useMemo(() => {
    if (!view) return [];
    return pendingSteps(view.steps).map((s) => ({
      id: s.stepKey,
      label: stepLabel(s.stepKey),
      done: s.status === "COMPLETED",
    }));
  }, [view]);

  const progressPct = useMemo(() => {
    if (!wizardSteps.length) return 0;
    const done = wizardSteps.filter((s) => s.done).length;
    return Math.round((done / wizardSteps.length) * 100);
  }, [wizardSteps]);

  const moduleOptions = useMemo(() => {
    const codes = selectedProducts.length ? selectedProducts : ["FORGE_INDUSTRIAL"];
    return codes.flatMap((code) => catalogModulesForSeed(code));
  }, [selectedProducts]);

  const roleOptions = useMemo(() => {
    const roles = view?.template?.roles ?? [];
    return roles.map((role) => {
      const friendly =
        BUSINESS_ROLES.find((item) => item.match.test(role.code) || item.match.test(role.name))?.label ??
        role.name;
      return { code: role.code, label: friendly };
    });
  }, [view]);

  async function startCompany() {
    setBusy(true);
    setError(null);
    setSaveState("saving");
    try {
      const typeMeta = COMPANY_TYPES.find((t) => t.value === customerType);
      const result = await onboardingStart({
        customerType,
        ...(typeMeta?.template ? { templateCode: typeMeta.template } : {}),
        tenantKey: normalizeKey(slug || displayName),
        slug: normalizeSlug(slug || displayName),
        legalName: legalName.trim() || displayName.trim(),
        displayName: displayName.trim(),
        timezone,
      });
      applyView(result.data, result.etag);
      setOrgDisplayName(displayName.trim());
      setOrgLegalName(legalName.trim() || displayName.trim());
      setOrgSlug(normalizeSlug(`${displayName}-org`));
      const product = result.data.template?.productCode;
      if (product) setSelectedProducts([product]);
      const modules = result.data.template?.modules?.map((m) => m.code) ?? [];
      if (modules.length) setSelectedModules(modules);
      const adminRole =
        result.data.template?.roles.find((r) => /ADMIN/i.test(r.code))?.code ??
        result.data.template?.roles[0]?.code ??
        "";
      setAdminRoleCode(adminRole);
      setSaveState("saved");
      toast.push("Company draft created", "success");
    } catch (err) {
      setSaveState("error");
      setError(humanizeForgeError(err instanceof Error ? err.message : "Could not create company."));
    } finally {
      setBusy(false);
    }
  }

  async function completeCurrent(payload: Record<string, unknown>) {
    if (!view || !etag || !activeStepKey) return;
    setBusy(true);
    setError(null);
    setSaveState("saving");
    try {
      const result = await onboardingCompleteStep(view.session.id, activeStepKey, payload, {
        ifMatch: etag,
        tenantId: view.session.tenantId,
      });
      applyView(result.data, result.etag);
      setSaveState("saved");
      toast.push("Progress saved", "success");
    } catch (err) {
      setSaveState("error");
      setError(humanizeForgeError(err instanceof Error ? err.message : "Could not save this step."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!view || !file) return;
    setLogoUploading(true);
    setError(null);
    try {
      const upload = await apiSend<{ documentId: string; uploadUrl: string }>(
        `/api/v1/tenants/${view.session.tenantId}/branding/assets/upload-url`,
        "POST",
        {
          kind: "logo",
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          contentLength: file.size,
        },
      );
      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("Logo upload failed. Please try again.");
      setLogoDocumentId(upload.documentId);
      setLogoPreview(URL.createObjectURL(file));
      setLogoName(file.name);
      setLogoSize(file.size);
      toast.push("Logo uploaded", "success");
    } catch (err) {
      setError(humanizeForgeError(err instanceof Error ? err.message : "Logo upload failed."));
    } finally {
      setLogoUploading(false);
    }
  }

  async function activateCompany() {
    if (!view || !etag) return;
    setBusy(true);
    setError(null);
    setSaveState("saving");
    try {
      // Ensure review is completed first if needed.
      const review = view.steps.find((s) => s.stepKey === "REVIEW_CONFIGURATION");
      let currentEtag = etag;
      if (review && review.status !== "COMPLETED") {
        const reviewed = await onboardingCompleteStep(
          view.session.id,
          "REVIEW_CONFIGURATION",
          { acknowledged: true },
          { ifMatch: currentEtag, tenantId: view.session.tenantId },
        );
        currentEtag = reviewed.etag ?? toIfMatch(reviewed.data.session.recordVersion);
        applyView(reviewed.data, currentEtag);
      }
      const result = await onboardingActivate(view.session.id, {
        ifMatch: currentEtag,
        tenantId: view.session.tenantId,
      });
      applyView(result.data, result.etag);
      setActivatedTenantId(result.data.session.tenantId);
      setPhase("success");
      setSaveState("saved");
      toast.push("Company activated", "success");
    } catch (err) {
      setSaveState("error");
      setError(humanizeForgeError(err instanceof Error ? err.message : "Activation failed."));
    } finally {
      setBusy(false);
    }
  }

  if (phase === "success" && activatedTenantId) {
    return (
      <section className={styles.page}>
        <ForgePageHeader
          title="Company activated"
          subtitle={`${displayName || "Company"} is ready to use Forge.`}
        />
        <Alert tone="success">
          Administrators can sign in with their invitation email. Continue setup anytime from the company page.
        </Alert>
        <div className={styles.actions} style={{ marginTop: "1rem" }}>
          <Link className={styles.button} href={tenantDetailHref(activatedTenantId)}>
            Open company
          </Link>
          <Link className={styles.buttonSecondary} href={`/imports/?tenantId=${activatedTenantId}`}>
            Import data
          </Link>
          <Link className={styles.buttonSecondary} href="/onboarding/new/">
            Add another company
          </Link>
          <Link className={styles.buttonSecondary} href="/">
            Return to dashboard
          </Link>
        </div>
      </section>
    );
  }

  if (phase === "start") {
    return (
      <section className={styles.page}>
        <ForgePageHeader
          title="Add company"
          subtitle="Create a draft company and walk through setup. Your progress saves automatically after each step."
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void startCompany();
          }}
        >
          <FormSection title="Company profile">
            <FormField label="Company name" htmlFor="displayName">
              <input
                id="displayName"
                className={styles.input}
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </FormField>
            <FormField label="Legal name" htmlFor="legalName">
              <input
                id="legalName"
                className={styles.input}
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </FormField>
            <FormField label="Company type" htmlFor="customerType">
              <select
                id="customerType"
                className={styles.input}
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as typeof customerType)}
              >
                {COMPANY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Time zone" htmlFor="timezone">
              <select
                id="timezone"
                className={styles.input}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="America/Chicago">Central Time</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </FormField>
            <FormField label="Web address" htmlFor="slug" hint="Used for the customer portal address. Forge fills this in for you.">
              <input
                id="slug"
                className={styles.input}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(normalizeSlug(e.target.value));
                }}
              />
            </FormField>
          </FormSection>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={busy || !displayName.trim()}>
              {busy ? "Saving…" : "Start setup"}
            </button>
            <Link className={styles.buttonSecondary} href="/onboarding/">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    );
  }

  const stepIndex = Math.max(
    0,
    wizardSteps.findIndex((s) => s.id === activeStepKey),
  );

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title={displayName || "Company setup"}
        subtitle={`Step ${stepIndex + 1} of ${wizardSteps.length || 1} · ${progressPct}% complete`}
      />
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
        <StatusBadge tone={saveState === "error" ? "danger" : saveState === "saved" ? "success" : "neutral"}>
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Unable to save — Retry"
                : "Ready"}
        </StatusBadge>
        {view ? <StatusBadge tone="info">{view.session.status.replace(/_/g, " ")}</StatusBadge> : null}
      </div>
      <ForgeStepper
        steps={wizardSteps.map((s) => ({ id: s.id, label: s.label }))}
        activeIndex={stepIndex}
      />
      {error ? <p className={styles.error}>{error}</p> : null}

      {activeStepKey === "CREATE_PRIMARY_ORGANIZATION" ? (
        <FormSection title="Organization">
          <p className={styles.muted}>This is the main organization under the company (usually the same name).</p>
          <FormField label="Organization name" htmlFor="orgDisplay">
            <input id="orgDisplay" className={styles.input} value={orgDisplayName} onChange={(e) => setOrgDisplayName(e.target.value)} />
          </FormField>
          <FormField label="Legal name" htmlFor="orgLegal">
            <input id="orgLegal" className={styles.input} value={orgLegalName} onChange={(e) => setOrgLegalName(e.target.value)} />
          </FormField>
          <FormField label="Short code" htmlFor="orgSlug">
            <input id="orgSlug" className={styles.input} value={orgSlug} onChange={(e) => setOrgSlug(normalizeSlug(e.target.value))} />
          </FormField>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() =>
              void completeCurrent({
                displayName: orgDisplayName,
                legalName: orgLegalName || orgDisplayName,
                slug: orgSlug || normalizeSlug(orgDisplayName),
                timezone,
              })
            }
          >
            Save and continue
          </button>
        </FormSection>
      ) : null}

      {activeStepKey === "SELECT_PRODUCTS" ? (
        <FormSection title="Products">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {catalogProducts.map((product) => {
              const checked = selectedProducts.includes(product.code);
              return (
                <label
                  key={product.code}
                  style={{
                    border: "1px solid var(--forge-color-border, #cbd5e0)",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    display: "block",
                    background: checked ? "rgba(49,130,206,0.08)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedProducts((prev) =>
                        prev.includes(product.code)
                          ? prev.filter((c) => c !== product.code)
                          : [...prev, product.code],
                      )
                    }
                  />{" "}
                  <strong>{product.name}</strong>
                  <p className={styles.muted} style={{ margin: "0.35rem 0 0" }}>
                    {product.description}
                  </p>
                </label>
              );
            })}
          </div>
          <button
            className={styles.button}
            type="button"
            disabled={busy || selectedProducts.length === 0}
            onClick={() => void completeCurrent({ productCodes: selectedProducts })}
            style={{ marginTop: "1rem" }}
          >
            Save and continue
          </button>
        </FormSection>
      ) : null}

      {activeStepKey === "SELECT_MODULES" ? (
        <FormSection title="Modules">
          <p className={styles.muted}>Turn modules on or off. Included package modules start enabled.</p>
          <div style={{ display: "grid", gap: "0.5rem", maxHeight: 360, overflow: "auto" }}>
            {moduleOptions.map((mod) => {
              const checked = selectedModules.includes(mod.code);
              const locked = mod.classification === "PLATFORM_CORE";
              return (
                <label key={`${mod.code}-${mod.name}`} style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={checked || locked}
                    disabled={locked}
                    onChange={() =>
                      setSelectedModules((prev) =>
                        prev.includes(mod.code)
                          ? prev.filter((c) => c !== mod.code)
                          : [...prev, mod.code],
                      )
                    }
                  />
                  <span>
                    {mod.name}
                    {locked ? " (required)" : ""}
                  </span>
                </label>
              );
            })}
          </div>
          <button
            className={styles.button}
            type="button"
            disabled={busy || selectedModules.length === 0}
            onClick={() => void completeCurrent({ moduleCodes: selectedModules })}
            style={{ marginTop: "1rem" }}
          >
            Save and continue
          </button>
        </FormSection>
      ) : null}

      {activeStepKey === "CONFIGURE_SUBSCRIPTION" ? (
        <FormSection title="Subscription">
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={waiveSubscription}
              onChange={(e) => setWaiveSubscription(e.target.checked)}
            />
            Start without billing for now (trial / implementation)
          </label>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() => void completeCurrent({ waiveSubscription: true, status: "TRIAL", periodDays: 30 })}
            style={{ marginTop: "1rem" }}
          >
            Save and continue
          </button>
        </FormSection>
      ) : null}

      {activeStepKey === "CONFIGURE_LOCATIONS" ? (
        <FormSection title="Locations">
          {locations.map((loc, index) => (
            <div key={index} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem", marginTop: "0.75rem" }}>
              <FormField label="Location name" htmlFor={`loc-name-${index}`}>
                <input
                  id={`loc-name-${index}`}
                  className={styles.input}
                  value={loc.name}
                  onChange={(e) =>
                    setLocations((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)),
                    )
                  }
                />
              </FormField>
              <FormField label="Street" htmlFor={`loc-street-${index}`}>
                <input
                  id={`loc-street-${index}`}
                  className={styles.input}
                  value={loc.addressLine1}
                  onChange={(e) =>
                    setLocations((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, addressLine1: e.target.value } : row)),
                    )
                  }
                />
              </FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                <FormField label="City" htmlFor={`loc-city-${index}`}>
                  <input
                    id={`loc-city-${index}`}
                    className={styles.input}
                    value={loc.city}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, city: e.target.value } : row)),
                      )
                    }
                  />
                </FormField>
                <FormField label="State" htmlFor={`loc-state-${index}`}>
                  <input
                    id={`loc-state-${index}`}
                    className={styles.input}
                    value={loc.stateProvince}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, stateProvince: e.target.value } : row)),
                      )
                    }
                  />
                </FormField>
                <FormField label="ZIP" htmlFor={`loc-zip-${index}`}>
                  <input
                    id={`loc-zip-${index}`}
                    className={styles.input}
                    value={loc.postalCode}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, postalCode: e.target.value } : row)),
                      )
                    }
                  />
                </FormField>
              </div>
            </div>
          ))}
          <div className={styles.actions} style={{ marginTop: "1rem" }}>
            <button
              className={styles.buttonSecondary}
              type="button"
              onClick={() =>
                setLocations((prev) => [
                  ...prev,
                  {
                    name: `Location ${prev.length + 1}`,
                    facilityType: "SITE",
                    addressLine1: "",
                    city: "",
                    stateProvince: "",
                    postalCode: "",
                    timezone,
                  },
                ])
              }
            >
              + Add location
            </button>
            <button
              className={styles.button}
              type="button"
              disabled={busy}
              onClick={() =>
                void completeCurrent({
                  locations: locations
                    .filter((l) => l.name.trim())
                    .map((l) => ({
                      name: l.name.trim(),
                      facilityType: l.facilityType,
                      addressLine1: l.addressLine1 || undefined,
                      city: l.city || undefined,
                      stateProvince: l.stateProvince || undefined,
                      postalCode: l.postalCode || undefined,
                      timezone: l.timezone || timezone,
                      countryCode: "US",
                    })),
                })
              }
            >
              Save and continue
            </button>
          </div>
        </FormSection>
      ) : null}

      {activeStepKey === "CONFIGURE_ORG_LOOKUPS" ? (
        <FormSection title="Departments & positions">
          <p className={styles.muted}>Optional now — you can add more later from Setup.</p>
          <FormField label="Departments" htmlFor="departments">
            <textarea
              id="departments"
              className={styles.input}
              rows={4}
              value={departments.map((d) => d.name).join("\n")}
              onChange={(e) =>
                setDepartments(
                  e.target.value
                    .split("\n")
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => ({ name })),
                )
              }
              placeholder={"One department per line\nMaintenance\nOperations"}
            />
          </FormField>
          <FormField label="Positions / job titles" htmlFor="positions">
            <textarea
              id="positions"
              className={styles.input}
              rows={3}
              value={positions.map((d) => d.name).join("\n")}
              onChange={(e) =>
                setPositions(
                  e.target.value
                    .split("\n")
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => ({ name })),
                )
              }
            />
          </FormField>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() =>
              void completeCurrent({
                departments,
                positions,
                employmentTypes: [{ name: "Full time" }, { name: "Part time" }],
              })
            }
          >
            Save and continue
          </button>
        </FormSection>
      ) : null}

      {activeStepKey === "CONFIGURE_BRANDING" ? (
        <FormSection title="Branding">
          <ForgeAssetUploader
            id="company-logo"
            label="Company logo"
            uploading={logoUploading}
            previewUrl={logoPreview}
            fileName={logoName}
            fileSize={logoSize}
            onSelect={(file: File | null) => void uploadLogo(file)}
            onRemove={() => {
              setLogoDocumentId(null);
              setLogoPreview(null);
              setLogoName(null);
              setLogoSize(null);
            }}
          />
          <FormField label="Primary color" htmlFor="primaryColor">
            <input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          </FormField>
          <FormField label="Secondary color" htmlFor="secondaryColor">
            <input id="secondaryColor" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
          </FormField>
          <FormField label="Support email" htmlFor="supportEmail">
            <input
              id="supportEmail"
              className={styles.input}
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
            />
          </FormField>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() =>
              void completeCurrent({
                primaryColor,
                secondaryColor,
                accentColor: primaryColor,
                supportEmail: supportEmail || undefined,
                emailSenderName: displayName || orgDisplayName,
                logoDocumentId,
              })
            }
          >
            Save and continue
          </button>
        </FormSection>
      ) : null}

      {activeStepKey === "CREATE_PRIMARY_ADMINISTRATOR" ? (
        <FormSection title="Primary administrator">
          <FormField label="First name" htmlFor="adminFirst">
            <input id="adminFirst" className={styles.input} value={adminFirst} onChange={(e) => setAdminFirst(e.target.value)} />
          </FormField>
          <FormField label="Last name" htmlFor="adminLast">
            <input id="adminLast" className={styles.input} value={adminLast} onChange={(e) => setAdminLast(e.target.value)} />
          </FormField>
          <FormField label="Email" htmlFor="adminEmail">
            <input id="adminEmail" className={styles.input} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </FormField>
          <FormField label="Role" htmlFor="adminRole">
            <select
              id="adminRole"
              className={styles.input}
              value={adminRoleCode}
              onChange={(e) => setAdminRoleCode(e.target.value)}
            >
              {roleOptions.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.label}
                </option>
              ))}
            </select>
          </FormField>
          <button
            className={styles.button}
            type="button"
            disabled={busy || !adminEmail || !adminFirst || !adminLast}
            onClick={() =>
              void completeCurrent({
                email: adminEmail.trim(),
                firstName: adminFirst.trim(),
                lastName: adminLast.trim(),
                roleCode: adminRoleCode || undefined,
              })
            }
          >
            Save and continue
          </button>
        </FormSection>
      ) : null}

      {activeStepKey === "SEND_INVITATION" ? (
        <FormSection title="Send invitation">
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={sendInviteNow} onChange={(e) => setSendInviteNow(e.target.checked)} />
            Send invitation now
          </label>
          <p className={styles.muted}>
            If unchecked, Forge still creates the invitation and you can send it when the company is activated.
          </p>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() => void completeCurrent({ send: sendInviteNow, expiresInHours: 168 })}
          >
            Save and continue
          </button>
        </FormSection>
      ) : null}

      {activeStepKey === "REVIEW_CONFIGURATION" || (!activeStepKey && view) ? (
        <FormSection title="Review & activate">
          <ul className={styles.list}>
            <li>Company information — Complete</li>
            <li>Products — {selectedProducts.map(productDisplayName).join(", ") || "Configured"}</li>
            <li>Modules — {selectedModules.length} enabled</li>
            <li>Locations — {locations.filter((l) => l.name.trim()).length} configured</li>
            <li>Departments — {departments.length} configured</li>
            <li>Administrator — {adminEmail || "Configured"}</li>
            <li>Logo — {logoDocumentId ? "Uploaded" : "Optional / defaults applied"}</li>
          </ul>
          <Alert tone="info">
            Activation prepares the company, turns on selected products and modules, invites the administrator, and
            creates default settings. You can import spreadsheets afterward from Data Import.
          </Alert>
          <div className={styles.actions} style={{ marginTop: "1rem" }}>
            <button className={styles.button} type="button" disabled={busy} onClick={() => void activateCompany()}>
              {busy ? "Activating…" : "Activate company"}
            </button>
            {view ? (
              <Link className={styles.buttonSecondary} href={`/imports/?tenantId=${view.session.tenantId}`}>
                Open data import (optional)
              </Link>
            ) : null}
          </div>
        </FormSection>
      ) : null}
    </section>
  );
}
