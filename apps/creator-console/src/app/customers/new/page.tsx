"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  ComingLater,
  FormField,
  FormSection,
  ForgePageHeader,
  ForgeStepper,
  StatusBadge,
  useToast,
} from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiGet, apiSend, createInvitation } from "@/lib/api";
import { productDisplayName } from "@/lib/presentation";
import styles from "../../page.module.css";

type Tenant = {
  id: string;
  tenantKey: string;
  displayName: string;
  slug: string;
};

type CatalogProduct = {
  code: string;
  name?: string;
  description?: string | null;
  status?: string;
};

type PlanRow = {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  status?: string;
};

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

const STEPS = [
  { id: "company", label: "Company" },
  { id: "products", label: "Products" },
  { id: "plan", label: "Plan" },
  { id: "admin", label: "Administrator" },
  { id: "address", label: "Web address" },
  { id: "review", label: "Review" },
];

type ProvisionStep = { id: string; label: string; done: boolean; failed?: boolean };

function AddCustomerInner() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [adminFirst, setAdminFirst] = useState("");
  const [adminLast, setAdminLast] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone] = useState("America/Chicago");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionSteps, setProvisionSteps] = useState<ProvisionStep[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const catalog = await apiGet<CatalogProduct[]>("/api/v1/platform/products");
        setProducts(catalog.filter((p) => (p.status ?? "ACTIVE") === "ACTIVE"));
      } catch {
        setProducts([
          { code: "FORGE_INDUSTRIAL", name: "Forge Industrial Safety", description: "Safety operations for industrial customers." },
          { code: "FORGE_RMS", name: "Forge RMS", description: "Records management for public safety agencies." },
          { code: "FORGE_ACADEMY", name: "Forge Academy", description: "Training and learning workflows." },
        ]);
      }
      try {
        setPlans(await apiGet<PlanRow[]>("/api/v1/platform/plans"));
      } catch {
        setPlans([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!slugTouched && displayName) {
      setSlug(normalizeSlug(displayName));
    }
  }, [displayName, slugTouched]);

  const webAddress = useMemo(
    () => `${normalizeSlug(slug) || "customer"}.forgepublicsafety.com`,
    [slug],
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId || p.code === selectedPlanId);

  function toggleProduct(code: string) {
    setSelectedProducts((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function goNext(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (step === 0) {
      if (!displayName.trim() || !legalName.trim()) {
        setError("Customer name and legal name are required.");
        return;
      }
    }
    if (step === 1 && selectedProducts.length === 0) {
      setError("Select at least one product.");
      return;
    }
    if (step === 3) {
      if (!adminFirst.trim() || !adminLast.trim() || !adminEmail.trim()) {
        setError("Administrator name and email are required.");
        return;
      }
    }
    if (step === 4 && normalizeSlug(slug).length < 2) {
      setError("Choose a valid web address slug.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function createCustomer() {
    setSubmitting(true);
    setProvisioning(true);
    setError(null);
    const key = normalizeKey(slug || displayName);
    const normalizedSlug = normalizeSlug(slug);
    const steps: ProvisionStep[] = [
      { id: "customer", label: "Creating customer", done: false },
      { id: "products", label: "Setting up products", done: false },
      { id: "admin", label: "Creating administrator invitation", done: false },
      { id: "address", label: "Preparing web address", done: false },
    ];
    setProvisionSteps([...steps]);

    try {
      const created = await apiSend<Tenant>(
        "/api/v1/platform/tenants",
        "POST",
        {
          tenantKey: key,
          slug: normalizedSlug,
          legalName: legalName.trim(),
          displayName: displayName.trim(),
          tenantType: "CUSTOMER",
          timezone,
          defaultLocale: "en-US",
          dataRegion: "us-east-1",
        },
        { idempotencyKey: crypto.randomUUID() },
      );
      steps[0] = { ...steps[0]!, done: true };
      setProvisionSteps([...steps]);
      setCreatedId(created.id);

      let productsOk = true;
      for (const code of selectedProducts) {
        try {
          await apiSend(`/api/v1/tenants/${created.id}/products/${code}`, "PUT", {
            status: "ACTIVE",
          });
        } catch {
          productsOk = false;
        }
      }
      steps[1] = { ...steps[1]!, done: true, failed: !productsOk };
      setProvisionSteps([...steps]);

      let adminOk = true;
      try {
        await createInvitation({
          tenantId: created.id,
          email: adminEmail.trim(),
          roleCodes: ["customer_admin"],
          firstName: adminFirst.trim(),
          lastName: adminLast.trim(),
        });
      } catch {
        try {
          await apiSend(`/api/v1/tenants/${created.id}/users/invitations`, "POST", {
            email: adminEmail.trim(),
            firstName: adminFirst.trim(),
            lastName: adminLast.trim(),
          });
        } catch {
          adminOk = false;
        }
      }
      steps[2] = { ...steps[2]!, done: true, failed: !adminOk };
      steps[3] = { ...steps[3]!, done: true };
      setProvisionSteps([...steps]);

      toast.push(`${displayName.trim()} is ready`, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't create this customer.");
      setProvisioning(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (provisioning && createdId) {
    const allDone = provisionSteps.every((s) => s.done);
    return (
      <section className={styles.page}>
        <ForgePageHeader title="Customer ready" subtitle={displayName} />
        <div className={styles.panel}>
          <ul className={styles.provisionList}>
            {provisionSteps.map((s) => (
              <li key={s.id}>
                <StatusBadge tone={s.failed ? "warning" : s.done ? "success" : "neutral"}>
                  {s.failed ? "Partial" : s.done ? "Done" : "…"}
                </StatusBadge>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
          {allDone ? (
            <div className={styles.actions} style={{ marginTop: "1.25rem" }}>
              <Link className="forge-btn" href={tenantDetailHref(createdId)}>
                Open Customer
              </Link>
              <Link className="forge-btn forge-btn--outline" href="/customers/">
                Back to customers
              </Link>
            </div>
          ) : null}
          <p className={styles.muted} style={{ marginTop: "1rem" }}>
            Facilities, branding, and modules can be finished from the customer page. Plan assignment is
            available when billing is configured.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title="Add customer"
        subtitle="Guided setup for a new Forge organization. Technical IDs stay behind the scenes."
      />
      <ForgeStepper steps={STEPS} activeIndex={step} />
      {error ? <p className={styles.error}>{error}</p> : null}

      {step === 0 ? (
        <form className={styles.panel} onSubmit={goNext}>
          <FormSection title="Company" description="Who is this customer?">
            <FormField label="Customer name" htmlFor="displayName" required hint="Example: Producers Rice Mill">
              <input
                id="displayName"
                className="forge-input"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </FormField>
            <FormField label="Legal / display name" htmlFor="legalName" required>
              <input
                id="legalName"
                className="forge-input"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </FormField>
            <FormField label="Primary contact email" htmlFor="contactEmail">
              <input
                id="contactEmail"
                type="email"
                className="forge-input"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </FormField>
            <FormField label="Phone" htmlFor="contactPhone">
              <input
                id="contactPhone"
                className="forge-input"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
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
        <form className={styles.panel} onSubmit={goNext}>
          <FormSection title="Products" description="Select one or more Forge products for this customer.">
            <div className={styles.productCardGrid}>
              {products.map((p) => {
                const selected = selectedProducts.includes(p.code);
                return (
                  <label
                    key={p.code}
                    className={[styles.productCard, selected ? styles.isSelected : ""].filter(Boolean).join(" ")}
                  >
                    <strong>{p.name ?? productDisplayName(p.code)}</strong>
                    <span className={styles.muted}>{p.description ?? "Forge product"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleProduct(p.code)}
                      />
                      {selected ? "Selected" : "Select"}
                    </span>
                  </label>
                );
              })}
            </div>
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
        <form className={styles.panel} onSubmit={goNext}>
          <FormSection
            title="Plan"
            description="Choose a plan when pricing is configured. You can finish this later from Billing."
          >
            {plans.length === 0 ? (
              <ComingLater>
                No plans are configured yet. Continue without a plan — assign pricing from Plans & Pricing
                after create.
              </ComingLater>
            ) : (
              <FormField label="Plan" htmlFor="plan">
                <select
                  id="plan"
                  className="forge-select"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                >
                  <option value="">Assign later</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <Alert tone="info">
              Custom pricing and implementation fees are managed after the customer exists when your role
              allows billing changes.
            </Alert>
          </FormSection>
          <div className={styles.actions}>
            <button className="forge-btn forge-btn--secondary" type="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="forge-btn" type="submit">
              Continue
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <form className={styles.panel} onSubmit={goNext}>
          <FormSection
            title="Administrator"
            description="This person will manage users and settings for this customer."
          >
            <FormField label="First name" htmlFor="adminFirst" required>
              <input
                id="adminFirst"
                className="forge-input"
                required
                value={adminFirst}
                onChange={(e) => setAdminFirst(e.target.value)}
              />
            </FormField>
            <FormField label="Last name" htmlFor="adminLast" required>
              <input
                id="adminLast"
                className="forge-input"
                required
                value={adminLast}
                onChange={(e) => setAdminLast(e.target.value)}
              />
            </FormField>
            <FormField label="Email" htmlFor="adminEmail" required>
              <input
                id="adminEmail"
                type="email"
                className="forge-input"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </FormField>
            <FormField label="Phone" htmlFor="adminPhone">
              <input
                id="adminPhone"
                className="forge-input"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
              />
            </FormField>
            <p className={styles.muted}>Role: Customer Administrator</p>
          </FormSection>
          <div className={styles.actions}>
            <button className="forge-btn forge-btn--secondary" type="button" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="forge-btn" type="submit">
              Continue
            </button>
          </div>
        </form>
      ) : null}

      {step === 4 ? (
        <form className={styles.panel} onSubmit={goNext}>
          <FormSection title="Web address" description="Suggested application address for this customer.">
            <FormField label="Address slug" htmlFor="slug" required hint="Letters, numbers, and hyphens.">
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
            <p>
              Web address: <strong>{webAddress}</strong>
            </p>
            <p className={styles.muted}>Availability is confirmed when the customer is created.</p>
          </FormSection>
          <div className={styles.actions}>
            <button className="forge-btn forge-btn--secondary" type="button" onClick={() => setStep(3)}>
              Back
            </button>
            <button className="forge-btn" type="submit">
              Continue
            </button>
          </div>
        </form>
      ) : null}

      {step === 5 ? (
        <div className={styles.panel}>
          <FormSection title="Review" description="Confirm before creating this customer.">
            <dl className={styles.dl}>
              <dt>Customer</dt>
              <dd>{displayName}</dd>
              <dt>Legal name</dt>
              <dd>{legalName}</dd>
              <dt>Products</dt>
              <dd>{selectedProducts.map(productDisplayName).join(", ")}</dd>
              <dt>Plan</dt>
              <dd>{selectedPlan?.name ?? "Assign later"}</dd>
              <dt>Administrator</dt>
              <dd>
                {adminFirst} {adminLast} · {adminEmail}
              </dd>
              <dt>Web address</dt>
              <dd>{webAddress}</dd>
            </dl>
          </FormSection>
          <div className={styles.actions}>
            <button className="forge-btn forge-btn--secondary" type="button" onClick={() => setStep(4)}>
              Back
            </button>
            <button className="forge-btn" type="button" disabled={submitting} onClick={() => void createCustomer()}>
              {submitting ? "Creating…" : "Create Customer"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function AddCustomerPage() {
  return (
    <PlatformPageGate title="Add customer" permission="platform.tenant.create">
      <AddCustomerInner />
    </PlatformPageGate>
  );
}
