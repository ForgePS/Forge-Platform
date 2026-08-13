"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CreatorLoading,
  CreatorPage,
  ErrorState,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";
import { personDetailHref, tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import { TenantRequired } from "@/components/tenant-required";
import { apiGet, apiSend } from "@/lib/api";
import styles from "../page.module.css";

type Person = {
  id: string;
  forgePersonNumber: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
};

function PersonsInner() {
  const tenantId = useTenantId();

  const [items, setItems] = useState<Person[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await apiGet<Person[]>(`/api/v1/tenants/${tenantId}/persons`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiSend(`/api/v1/tenants/${tenantId}/persons`, "POST", {
        firstName,
        lastName,
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create person");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenantId) {
    return (
      <CreatorPage title="Persons">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Persons"
      subtitle={<Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>}
    >
      {error ? (
        error.toLowerCase().includes("create") ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <ErrorState title="We couldn't load this information." description={error} />
        )
      ) : null}

      <ForgePageSection title="Create person">
        <form className={styles.form} onSubmit={onCreate}>
          <div className={styles.formRow}>
            <label htmlFor="firstName">First name</label>
            <input
              id="firstName"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="lastName">Last name</label>
            <input
              id="lastName"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="email">Email (optional)</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </ForgePageSection>

      <ForgePageSection title="Persons" flush>
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && items.length === 0 ? <p className={styles.muted}>No persons yet.</p> : null}
        {items.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Forge #</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((person) => (
                <tr key={person.id}>
                  <td>
                    <Link href={personDetailHref(person.id, tenantId)}>{person.displayName}</Link>
                  </td>
                  <td className={styles.mono}>{person.forgePersonNumber}</td>
                  <td>{person.email ?? "—"}</td>
                  <td>
                    <ForgeStatusBadge status={person.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function PersonsPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <PersonsInner />
    </Suspense>
  );
}
