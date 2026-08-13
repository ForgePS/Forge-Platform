"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ConfirmationDialog,
  FormField,
  FormSection,
  ForgePageHeader,
  ForgeStepper,
  useToast,
} from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiSend } from "@/lib/api";
import styles from "../../page.module.css";

type Tenant = {
  id: string;
  tenantKey: string;
  displayName: string;
};

function normalizeTenantKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
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

const STEPS = [
  { id: "identity", label: "Identity" },
  { id: "profile", label: "Profile" },
  { id: "review", label: "Review" },
];

function AddCustomerInner() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [tenantKey, setTenantKey] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function nextFromIdentity(event: FormEvent) {
    event.preventDefault();
    const key = normalizeTenantKey(tenantKey);
    const normalizedSlug = normalizeSlug(slugTouched ? slug : tenantKey);
    if (key.length < 2 || normalizedSlug.length < 2) {
      setError("Customer key and slug must be at least 2 characters.");
      return;
    }
    setTenantKey(key);
    setSlug(normalizedSlug);
    setError(null);
    setStep(1);
  }

  function nextFromProfile(event: FormEvent) {
    event.preventDefault();
    if (!legalName.trim() || !displayName.trim()) {
      setError("Legal name and display name are required.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function createCustomer() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiSend<Tenant>(
        "/api/v1/platform/tenants",
        "POST",
        {
          tenantKey: normalizeTenantKey(tenantKey),
          slug: normalizeSlug(slug),
          legalName: legalName.trim(),
          displayName: displayName.trim(),
          tenantType: "CUSTOMER",
          timezone,
          defaultLocale: "en-US",
          dataRegion: "us-east-1",
        },
        { idempotencyKey: crypto.randomUUID() },
      );
      toast.push("Customer created", "success");
      setConfirmOpen(false);
      router.push(tenantDetailHref(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title="Add customer"
        subtitle="Creates a platform tenant via the existing tenants API. No client-side provisioning."
      />
      <ForgeStepper steps={STEPS} activeIndex={step} />
      {error ? <p className={styles.error}>{error}</p> : null}

      {step === 0 ? (
        <form className={styles.panel} onSubmit={nextFromIdentity}>
          <FormSection title="Customer identity" description="Stable key and URL slug for the tenant.">
            <FormField label="Customer key" htmlFor="tenantKey" required hint="Lowercase letters, numbers, hyphen, underscore.">
              <input
                id="tenantKey"
                className="forge-input"
                required
                value={tenantKey}
                onChange={(e) => {
                  const next = e.target.value;
                  setTenantKey(next);
                  if (!slugTouched) setSlug(normalizeSlug(next));
                }}
                onBlur={() => setTenantKey((v) => normalizeTenantKey(v))}
              />
            </FormField>
            <FormField label="Slug" htmlFor="slug" required>
              <input
                id="slug"
                className="forge-input"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                onBlur={() => setSlug((v) => normalizeSlug(v))}
              />
            </FormField>
          </FormSection>
          <div className={styles.actions}>
            <Link className="forge-btn forge-btn--secondary" href="/customers/">
              Cancel
            </Link>
            <button className="forge-btn" type="submit">
              Continue
            </button>
          </div>
        </form>
      ) : null}

      {step === 1 ? (
        <form className={styles.panel} onSubmit={nextFromProfile}>
          <FormSection title="Customer profile">
            <FormField label="Legal name" htmlFor="legalName" required>
              <input id="legalName" className="forge-input" required value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </FormField>
            <FormField label="Display name" htmlFor="displayName" required>
              <input id="displayName" className="forge-input" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </FormField>
            <FormField label="Timezone" htmlFor="timezone">
              <input id="timezone" className="forge-input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </FormField>
          </FormSection>
          <div className={styles.actions}>
            <button className="forge-btn forge-btn--secondary" type="button" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="forge-btn" type="submit">
              Continue
            </button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <div className={styles.panel}>
          <FormSection title="Review" description="Confirm before calling the tenants create API.">
            <dl className={styles.dl}>
              <dt>Key</dt>
              <dd className={styles.mono}>{normalizeTenantKey(tenantKey)}</dd>
              <dt>Slug</dt>
              <dd className={styles.mono}>{normalizeSlug(slug)}</dd>
              <dt>Legal name</dt>
              <dd>{legalName}</dd>
              <dt>Display name</dt>
              <dd>{displayName}</dd>
              <dt>Timezone</dt>
              <dd>{timezone}</dd>
            </dl>
          </FormSection>
          <div className={styles.actions}>
            <button className="forge-btn forge-btn--secondary" type="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="forge-btn" type="button" onClick={() => setConfirmOpen(true)}>
              Create customer
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmationDialog
        open={confirmOpen}
        title="Create customer?"
        description="This calls POST /api/v1/platform/tenants. The tenant becomes available immediately after success."
        confirmLabel="Create"
        busy={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void createCustomer()}
      />
    </section>
  );
}

export default function AddCustomerPage() {
  return (
    <PlatformPageGate title="Add customer" permission="platform.tenant.read">
      <AddCustomerInner />
    </PlatformPageGate>
  );
}
