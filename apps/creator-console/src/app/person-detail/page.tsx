"use client";

import {
  CreatorLoading,
  CreatorPage,
  ErrorState,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { TenantRequired } from "@/components/tenant-required";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiGetResult, apiSend, toIfMatch } from "@/lib/api";
import styles from "../page.module.css";

type Person = {
  id: string;
  forgePersonNumber: string;
  displayName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  status: string;
  recordSource: string;
  recordVersion: number;
};

type PersonForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  preferredName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
};

function formFromPerson(person: Person): PersonForm {
  return {
    firstName: person.firstName ?? "",
    middleName: person.middleName ?? "",
    lastName: person.lastName ?? "",
    suffix: person.suffix ?? "",
    preferredName: person.preferredName ?? "",
    email: person.email ?? "",
    phone: person.phone ?? "",
    dateOfBirth: person.dateOfBirth ? String(person.dateOfBirth).slice(0, 10) : "",
  };
}

function PersonDetailInner() {
  const searchParams = useSearchParams();
  const personId = searchParams.get("personId");
  const tenantId = searchParams.get("tenantId");

  const [person, setPerson] = useState<Person | null>(null);
  const [form, setForm] = useState<PersonForm | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId && personId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !personId) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const result = await apiGetResult<Person>(`/api/v1/tenants/${tenantId}/persons/${personId}`);
      setPerson(result.data);
      setForm(formFromPerson(result.data));
      setEtag(result.etag ?? toIfMatch(result.data.recordVersion));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, personId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !personId || !form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      let ifMatch = etag ?? undefined;
      if (!ifMatch) {
        const fresh = await apiGetResult<Person>(`/api/v1/tenants/${tenantId}/persons/${personId}`);
        ifMatch = fresh.etag ?? toIfMatch(fresh.data.recordVersion);
        setEtag(ifMatch);
      }
      const updated = await apiSend<Person>(
        `/api/v1/tenants/${tenantId}/persons/${personId}`,
        "PATCH",
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          middleName: form.middleName.trim() || null,
          suffix: form.suffix.trim() || null,
          preferredName: form.preferredName.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          dateOfBirth: form.dateOfBirth.trim() || null,
        },
        { ifMatch },
      );
      setPerson(updated);
      setForm(formFromPerson(updated));
      setEtag(toIfMatch(updated.recordVersion));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!tenantId || !personId) {
    return (
      <CreatorPage title="Person detail">
        <TenantRequired />
      </CreatorPage>
    );
  }

  const q = `?tenantId=${encodeURIComponent(tenantId)}`;

  return (
    <CreatorPage
      title="Person detail"
      subtitle={
        <>
          <Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>
          {" · "}
          <Link href={`/persons${q}`}>Persons</Link>
          {" · "}
          <Link href="/profile/">My profile</Link>
        </>
      }
    >
      {error ? (
        error.toLowerCase().includes("save") ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <ErrorState title="We couldn't load this information." description={error} />
        )
      ) : null}
      {saved ? <p className={styles.success}>Person saved.</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {person && form ? (
        <ForgePageSection title={person.displayName}>
          <dl className={styles.dl}>
            <dt>Forge #</dt>
            <dd className={styles.mono}>{person.forgePersonNumber}</dd>
            <dt>Status</dt>
            <dd>
              <ForgeStatusBadge status={person.status} />
            </dd>
            <dt>Record source</dt>
            <dd>{person.recordSource}</dd>
          </dl>
          <details className="forge-advanced-details">
            <summary>Advanced Details</summary>
            <dl className={styles.dl}>
              <dt>Person ID</dt>
              <dd className={styles.mono}>{person.id}</dd>
              <dt>Customer ID</dt>
              <dd className={styles.mono}>{tenantId}</dd>
            </dl>
          </details>

          <form className={styles.form} onSubmit={(e) => void onSave(e)}>
            {(
              [
                ["firstName", "First name", true],
                ["lastName", "Last name", true],
                ["middleName", "Middle name", false],
                ["suffix", "Suffix", false],
                ["preferredName", "Preferred name", false],
                ["email", "Email", false],
                ["phone", "Phone", false],
                ["dateOfBirth", "Date of birth", false],
              ] as const
            ).map(([key, label, required]) => (
              <div className={styles.formRow} key={key}>
                <label htmlFor={`person-${key}`}>{label}</label>
                <input
                  id={`person-${key}`}
                  type={key === "email" ? "email" : key === "dateOfBirth" ? "date" : "text"}
                  required={required}
                  value={form[key]}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
                />
              </div>
            ))}
            <div className={styles.actions}>
              <button type="submit" className={styles.button} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </ForgePageSection>
      ) : null}
    </CreatorPage>
  );
}

export default function PersonDetailPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <PersonDetailInner />
    </Suspense>
  );
}
