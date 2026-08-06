"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import { TenantRequired } from "@/components/tenant-required";
import { apiGet, apiSend } from "@/lib/api";
import styles from "../page.module.css";

type User = {
  id: string;
  primaryEmail: string;
  username: string | null;
  status: string;
  personId: string | null;
  invitedAt: string | null;
  activatedAt: string | null;
};

type InviteResult = {
  invitationId: string;
  userId: string;
  email: string;
  expiresAt: string;
  token: string;
};

function UsersInner() {
  const tenantId = useTenantId();

  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await apiGet<User[]>(`/api/v1/tenants/${tenantId}/users`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);
    setInviteResult(null);
    try {
      const result = await apiSend<InviteResult>(
        `/api/v1/tenants/${tenantId}/users/invitations`,
        "POST",
        { email: email.trim() },
      );
      setInviteResult(result);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenantId) {
    return (
      <section className={styles.page}>
        <h1>Users</h1>
        <TenantRequired />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1>Users</h1>
      <p className={styles.lead}>
        Tenant <span className={styles.mono}>{tenantId}</span> ·{" "}
        <Link href={tenantDetailHref(tenantId)}>Tenant detail</Link> ·{" "}
        <Link href={`/roles?tenantId=${encodeURIComponent(tenantId)}`}>Roles</Link>
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}
      {inviteResult ? (
        <div className={styles.success}>
          Invited {inviteResult.email}. Invitation token (shown once):{" "}
          <span className={styles.mono}>{inviteResult.token}</span>
        </div>
      ) : null}

      <div className={styles.panel}>
        <h2>Invite user</h2>
        <form className={styles.form} onSubmit={onInvite}>
          <div className={styles.formRow}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "Inviting…" : "Invite"}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.panel}>
        <h2>Users</h2>
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && items.length === 0 ? <p className={styles.muted}>No users yet.</p> : null}
        {items.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Username</th>
                <th>Status</th>
                <th>User ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id}>
                  <td>{user.primaryEmail}</td>
                  <td>{user.username ?? "—"}</td>
                  <td>{user.status}</td>
                  <td className={styles.mono}>{user.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <UsersInner />
    </Suspense>
  );
}
