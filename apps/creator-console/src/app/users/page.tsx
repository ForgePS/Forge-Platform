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
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
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
      <CreatorPage title="Users">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Users"
      subtitle={
        <>
          <Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>
          {" · "}
          <Link href={`/roles?tenantId=${encodeURIComponent(tenantId)}`}>Roles</Link>
        </>
      }
    >
      {error ? (
        error.toLowerCase().includes("invite") || error.toLowerCase().includes("failed to invite") ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <ErrorState title="We couldn't load this information." description={error} />
        )
      ) : null}
      {inviteResult ? (
        <div className={styles.success}>
          Invited {inviteResult.email}. Invitation token (shown once):{" "}
          <span className={styles.mono}>{inviteResult.token}</span>
        </div>
      ) : null}

      <ForgePageSection title="Invite user">
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
      </ForgePageSection>

      <ForgePageSection title="Users" flush>
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
                  <td>
                    <ForgeStatusBadge status={user.status} />
                  </td>
                  <td className={styles.mono}>{user.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <UsersInner />
    </Suspense>
  );
}
