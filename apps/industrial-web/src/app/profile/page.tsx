"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGetResult, apiSend, toIfMatch, useAuth } from "@forge/web-kit";

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

/**
 * Signed-in user profile (FORGE industrial shell).
 * Edits platform person demographics when me.personId is linked on the active tenant.
 */
export default function IndustrialProfilePage() {
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
      setError(err instanceof Error ? err.message : "Failed to load profile");
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
      <div className="ind-content">
        <h1>My profile</h1>
        <p className="ind-muted">Loading session…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="ind-content">
        <h1>My profile</h1>
        <p className="ind-error">Sign in to view your profile.</p>
      </div>
    );
  }

  const initials = (me.isPlatformAdmin ? "PA" : me.userId.slice(0, 2)).toUpperCase();

  return (
    <div className="ind-content ind-profile">
      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <span className="avatar avatar-md">
          <span className="avatar-initial rounded-circle bg-label-primary">{initials}</span>
        </span>
        <div>
          <h1 className="mb-1">My profile</h1>
          <p className="text-muted mb-0">
            Account for the signed-in Industrial user. Person demographics can be edited when a
            linked person exists on the active tenant.
          </p>
        </div>
      </div>

      {error ? (
        <p className="ind-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-success mb-3" role="status">
          Profile saved.
        </p>
      ) : null}

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h6">Session</h2>
          <dl className="ind-profile-dl mb-0">
            <div>
              <dt>User ID</dt>
              <dd className="font-monospace small">{me.userId}</dd>
            </div>
            <div>
              <dt>Active tenant</dt>
              <dd className="font-monospace small">{me.tenantId ?? "—"}</dd>
            </div>
            <div>
              <dt>Person ID</dt>
              <dd className="font-monospace small">{me.personId ?? "—"}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{me.isPlatformAdmin ? "Platform admin" : "Tenant member"}</dd>
            </div>
          </dl>
        </div>
      </div>

      {!personId || !tenantId ? (
        <div className="card">
          <div className="card-body">
            <h2 className="h6">Editable person profile unavailable</h2>
            <p className="text-muted mb-0">
              This Cognito user has no linked person on the active tenant, so name/email/phone cannot
              be edited here yet. Ask an administrator to link a person record, or open Creator →
              Persons if you manage the tenant there.
            </p>
          </div>
        </div>
      ) : loading ? (
        <p className="ind-muted" role="status">
          Loading person…
        </p>
      ) : person ? (
        <div className="card">
          <div className="card-body">
            <h2 className="h6 mb-1">{person.displayName || "Person profile"}</h2>
            <p className="text-muted small mb-3">
              Forge # <span className="font-monospace">{person.forgePersonNumber}</span> ·{" "}
              {person.status}
            </p>
            <form className="ind-ops-create border-0 shadow-none p-0" onSubmit={(e) => void onSave(e)}>
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
                <label key={key}>
                  {label}
                  <input
                    type={key === "email" ? "email" : key === "dateOfBirth" ? "date" : "text"}
                    required={required}
                    value={form[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    autoComplete={key === "email" ? "email" : "off"}
                  />
                </label>
              ))}
              <div className="d-flex flex-wrap gap-2">
                <button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </button>
                <button type="button" disabled={saving} onClick={() => void loadPerson()}>
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <p className="mt-3 mb-0">
        <Link href="/">← Dashboard</Link>
        {" · "}
        <Link href="/settings/">Settings</Link>
      </p>
    </div>
  );
}
