"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@forge/web-kit";
import {
  CreatorPage,
  ErrorState,
  ForgePageSection,
} from "@/components/creator-page";
import { apiGetResult, apiSend, toIfMatch } from "@/lib/api";
import { personDetailHref } from "@/hooks/use-tenant-id";
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

function emptyForm(): PersonForm {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    preferredName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
  };
}

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

export default function MyProfilePage() {
  const { me, loading: authLoading } = useAuth();
  const [person, setPerson] = useState<Person | null>(null);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const tenantId = me?.tenantId ?? null;
  const personId = me?.personId ?? null;

  const loadPerson = useCallback(async () => {
    if (!tenantId || !personId) {
      setPerson(null);
      return;
    }
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
      setPerson(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, personId]);

  useEffect(() => {
    void loadPerson();
  }, [loadPerson]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !personId) return;
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

  if (authLoading) {
    return (
      <CreatorPage title="My profile">
        <p className={styles.muted}>Loading session…</p>
      </CreatorPage>
    );
  }

  if (!me) {
    return (
      <CreatorPage title="My profile">
        <p className={styles.error}>Sign in to view your profile.</p>
        <Link href="/login/">Sign in</Link>
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="My profile"
      subtitle="Account for the signed-in Creator user. Person demographics can be edited when a linked person record exists on the active tenant."
    >
      {error ? (
        error.toLowerCase().includes("save") ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <ErrorState title="We couldn't load this information." description={error} />
        )
      ) : null}
      {saved ? <p className={styles.success}>Profile saved.</p> : null}

      <ForgePageSection title="Session">
        <dl className={styles.dl}>
          <dt>Role</dt>
          <dd>{me.isPlatformAdmin ? "Platform admin" : "Tenant member"}</dd>
        </dl>
        <details className="forge-advanced-details">
          <summary>Advanced Details</summary>
          <dl className={styles.dl}>
            <dt>User ID</dt>
            <dd className={styles.mono}>{me.userId}</dd>
            <dt>Active tenant</dt>
            <dd className={styles.mono}>{me.tenantId ?? "—"}</dd>
            <dt>Person ID</dt>
            <dd className={styles.mono}>{me.personId ?? "—"}</dd>
          </dl>
        </details>
      </ForgePageSection>

      {!personId || !tenantId ? (
        <ForgePageSection title="Editable person profile unavailable">
          <p className={styles.muted}>
            This Cognito user has no linked person on the active tenant, so name/email/phone cannot
            be edited here yet. Link or create a person under{" "}
            <Link href="/persons/">Persons</Link>, then reopen this page.
          </p>
        </ForgePageSection>
      ) : loading ? (
        <p className={styles.muted}>Loading person…</p>
      ) : person ? (
        <ForgePageSection title={person.displayName || "Person profile"}>
          <p className={styles.muted}>
            Forge # <span className={styles.mono}>{person.forgePersonNumber}</span> ·{" "}
            <Link href={personDetailHref(person.id, tenantId)}>Open person detail</Link>
          </p>
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
                <label htmlFor={`profile-${key}`}>{label}</label>
                <input
                  id={`profile-${key}`}
                  type={key === "email" ? "email" : key === "dateOfBirth" ? "date" : "text"}
                  required={required}
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  autoComplete={key === "email" ? "email" : "off"}
                />
              </div>
            ))}
            <div className={styles.actions}>
              <button type="submit" className={styles.button} disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={saving}
                onClick={() => void loadPerson()}
              >
                Reset
              </button>
            </div>
          </form>
        </ForgePageSection>
      ) : null}
    </CreatorPage>
  );
}
