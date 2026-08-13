"use client";

import {
  CreatorPage,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import styles from "../page.module.css";

export default function SelectTenantPage() {
  const router = useRouter();
  const { me, loading, error, chooseTenant } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function onSelect(tenantId: string) {
    setBusyId(tenantId);
    setActionError(null);
    try {
      await chooseTenant(tenantId);
      router.push("/");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to select tenant");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <CreatorPage title="Select customer" subtitle="Choose which customer to work in for this session.">
      {error ? <p className={styles.error}>{error}</p> : null}
      {actionError ? <p className={styles.error}>{actionError}</p> : null}
      {loading ? <p className={styles.muted}>Loading tenants…</p> : null}

      {!loading && !me ? (
        <ForgePageSection title="Sign in required">
          <p className={styles.muted}>
            Not authenticated. <Link href="/login">Sign in</Link> first.
          </p>
        </ForgePageSection>
      ) : null}

      {me ? (
        <ForgePageSection title="Available customers" flush>
          {me.tenants.length === 0 ? (
            <p className={styles.muted}>No customers available for this user.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Display name</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Membership</th>
                  <th>Current</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {me.tenants.map((tenant) => (
                  <tr key={tenant.tenantId}>
                    <td>{tenant.displayName}</td>
                    <td className={styles.mono}>{tenant.slug}</td>
                    <td>
                      <ForgeStatusBadge status={tenant.tenantStatus} />
                    </td>
                    <td>
                      <ForgeStatusBadge status={tenant.membershipStatus} />
                    </td>
                    <td>{tenant.tenantId === me.tenantId ? "Yes" : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.buttonSecondary}
                        disabled={!tenant.selectable || busyId === tenant.tenantId}
                        onClick={() => void onSelect(tenant.tenantId)}
                      >
                        {busyId === tenant.tenantId ? "Selecting…" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ForgePageSection>
      ) : null}

      <details className="forge-advanced-details">
        <summary>Advanced Details</summary>
        <p className={styles.muted}>
          Calls <code>POST /api/v1/auth/select-tenant</code> and refreshes{" "}
          <code>GET /api/v1/auth/me</code>.
        </p>
      </details>
    </CreatorPage>
  );
}
