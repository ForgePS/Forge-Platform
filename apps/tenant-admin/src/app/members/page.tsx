"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { TenantPageGate } from "@/components/tenant-page-gate";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import {
  activateMembership,
  getMembership,
  listMemberships,
  revokeMembership,
  suspendMembership,
  toIfMatch,
  type Membership,
} from "@/lib/api";
import styles from "../page.module.css";

function MembersInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("platform.membership.manage");
  const [items, setItems] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listMemberships(tenantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(membership: Membership, action: "activate" | "suspend" | "revoke") {
    if (!tenantId || !canManage) return;
    if ((action === "suspend" || action === "revoke") && !reason.trim()) {
      setError(`${action} requires a reason`);
      return;
    }
    setBusyId(membership.id);
    setError(null);
    try {
      const fresh = await getMembership(tenantId, membership.id);
      const ifMatch = fresh.etag ?? toIfMatch(fresh.data.recordVersion);
      if (action === "activate") {
        await activateMembership(tenantId, membership.id, ifMatch);
      } else if (action === "suspend") {
        await suspendMembership(tenantId, membership.id, reason.trim(), ifMatch);
      } else {
        await revokeMembership(tenantId, membership.id, reason.trim(), ifMatch);
      }
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Membership action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!tenantId) {
    return (
      <section className={styles.page}>
        <h1>Members</h1>
        <TenantRequired />
      </section>
    );
  }

  const q = tenantQuery(tenantId);

  return (
    <section className={styles.page}>
      <h1>Members</h1>
      <p className={styles.lead}>
        Tenant memberships · <Link href={`/invitations${q}`}>Invitations</Link> ·{" "}
        <Link href={`/roles${q}`}>Roles</Link>
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {canManage ? (
        <div className={styles.panel}>
          <h2>Action reason</h2>
          <div className={styles.formRow}>
            <label htmlFor="reason">Required for suspend / revoke</label>
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
      ) : null}

      <div className={styles.panel}>
        <h2>Memberships</h2>
        {items.length === 0 ? (
          <p className={styles.muted}>No memberships.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>User status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.email}</td>
                  <td>{row.status}</td>
                  <td>{row.userStatus}</td>
                  <td>
                    {canManage ? (
                      <div className={styles.actions}>
                        <button
                          className={styles.buttonSecondary}
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void runAction(row, "activate")}
                        >
                          Activate
                        </button>
                        <button
                          className={styles.buttonSecondary}
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void runAction(row, "suspend")}
                        >
                          Suspend
                        </button>
                        <button
                          className={styles.buttonDanger}
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void runAction(row, "revoke")}
                        >
                          Revoke
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function MembersPage() {
  return (
    <TenantPageGate title="Members" permission="platform.membership.read">
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <MembersInner />
      </Suspense>
    </TenantPageGate>
  );
}
