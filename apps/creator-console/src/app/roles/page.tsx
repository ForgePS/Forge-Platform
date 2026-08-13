"use client";

import {
  CreatorLoading,
  CreatorPage,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet, apiGetResult, apiSend, apiSendResult, toIfMatch } from "@/lib/api";
import styles from "../page.module.css";

type Role = {
  id: string;
  code: string;
  name: string;
  status: string;
  description: string | null;
  recordVersion: number;
};

type RoleDetail = Role & {
  permissions: Array<{ code: string; effect: string }>;
};

type Permission = {
  id: string;
  code: string;
  name: string;
  category: string | null;
};

type User = {
  id: string;
  primaryEmail: string;
  status: string;
};

function RolesInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canAssign = hasPermission("platform.role.assign");
  const canRead = hasPermission("platform.permission.read");

  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [userId, setUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [reason, setReason] = useState("");

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editRoleId, setEditRoleId] = useState("");
  const [editEtag, setEditEtag] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [permSearch, setPermSearch] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [roleRows, userRows, permRows] = await Promise.all([
        apiGet<Role[]>(`/api/v1/tenants/${tenantId}/roles`),
        apiGet<User[]>(`/api/v1/tenants/${tenantId}/users`),
        canRead
          ? apiGet<Permission[]>(`/api/v1/tenants/${tenantId}/permissions`)
          : Promise.resolve([] as Permission[]),
      ]);
      setRoles(roleRows);
      setUsers(userRows);
      setPermissions(permRows);
      setAssignRoleId((current) => current || roleRows[0]?.id || "");
      setUserId((current) => current || userRows[0]?.id || "");
      setEditRoleId((current) => current || roleRows[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRoleDetail = useCallback(
    async (roleId: string) => {
      if (!tenantId || !roleId) return;
      setError(null);
      try {
        const result = await apiGetResult<RoleDetail>(
          `/api/v1/tenants/${tenantId}/roles/${roleId}`,
        );
        setEditEtag(result.etag ?? toIfMatch(result.data.recordVersion));
        setSelectedCodes(new Set(result.data.permissions.map((p) => p.code)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "We couldn't load this information.");
      }
    },
    [tenantId],
  );

  useEffect(() => {
    if (editRoleId) {
      void loadRoleDetail(editRoleId);
    } else {
      setSelectedCodes(new Set());
      setEditEtag(null);
    }
  }, [editRoleId, loadRoleDetail]);

  const filteredPermissions = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [permissions, permSearch]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !canAssign) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const payload: { code: string; name: string; description?: string } = {
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
      };
      if (newDescription.trim()) payload.description = newDescription.trim();
      const created = await apiSend<Role>(`/api/v1/tenants/${tenantId}/roles`, "POST", payload);
      setMessage(`Created role ${created.code}.`);
      setNewCode("");
      setNewName("");
      setNewDescription("");
      await load();
      setEditRoleId(created.id);
      setAssignRoleId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSavePermissions(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !editRoleId || !editEtag || !canAssign) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiSendResult<Role>(
        `/api/v1/tenants/${tenantId}/roles/${editRoleId}/permissions`,
        "PUT",
        { permissionCodes: Array.from(selectedCodes).sort() },
        { ifMatch: editEtag },
      );
      setEditEtag(result.etag ?? toIfMatch(result.data.recordVersion));
      setMessage(`Saved ${selectedCodes.size} permission(s) on role.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role permissions");
      await loadRoleDetail(editRoleId);
    } finally {
      setSubmitting(false);
    }
  }

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !userId || !assignRoleId || !canAssign) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await apiSend(`/api/v1/tenants/${tenantId}/users/${userId}/role-assignments`, "POST", {
        roleId: assignRoleId,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setMessage("Role assigned to user.");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign role");
    } finally {
      setSubmitting(false);
    }
  }

  function togglePermission(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (!tenantId) {
    return (
      <CreatorPage title="Roles">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Roles"
      subtitle={
        <>
          <Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>
          {" · "}
          <Link href={`/users?tenantId=${encodeURIComponent(tenantId)}`}>Users</Link>
          {" · "}
          <Link href={`/permissions?tenantId=${encodeURIComponent(tenantId)}`}>Permissions</Link>
        </>
      }
    >

      {!canAssign ? (
        <p className={styles.error}>Missing permission: platform.role.assign (needed to create/edit)</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.success}>{message}</p> : null}

      <ForgePageSection title="Create role">
        <form className={styles.form} onSubmit={onCreate}>
          <div className={styles.formRow}>
            <label htmlFor="newCode">Code</label>
            <input
              id="newCode"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="CUSTOM_OPERATOR"
              pattern="^[A-Z][A-Z0-9_]*$"
              required
              disabled={!canAssign}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="newName">Name</label>
            <input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              disabled={!canAssign}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="newDescription">Description</label>
            <input
              id="newDescription"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              disabled={!canAssign}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={submitting || !canAssign}>
              {submitting ? "Creating…" : "Create role"}
            </button>
          </div>
        </form>
      </ForgePageSection>

      <ForgePageSection title="Role permissions">
        <p className={styles.muted}>
          Sets live <code>role_permissions</code> for the selected role (If-Match concurrency).
        </p>
        <form className={styles.form} onSubmit={onSavePermissions}>
          <div className={styles.formRow}>
            <label htmlFor="editRoleId">Role</label>
            <select
              id="editRoleId"
              value={editRoleId}
              onChange={(e) => setEditRoleId(e.target.value)}
              disabled={!roles.length}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="permSearch">Filter permissions</label>
            <input
              id="permSearch"
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
              placeholder="platform.tenant"
              disabled={!canRead}
            />
          </div>
          {!canRead ? (
            <p className={styles.error}>Need platform.permission.read to load the catalog.</p>
          ) : (
            <div className={styles.permList} role="group" aria-label="Role permissions">
              {filteredPermissions.map((p) => (
                <div key={p.id} className={styles.permItem}>
                  <input
                    id={`perm-${p.id}`}
                    type="checkbox"
                    checked={selectedCodes.has(p.code)}
                    onChange={() => togglePermission(p.code)}
                    disabled={!canAssign || !editRoleId}
                    aria-label={`${p.code} — ${p.name}`}
                  />
                  <label htmlFor={`perm-${p.id}`}>
                    <span className={styles.mono}>{p.code}</span>
                    <span className={styles.muted}>
                      {" "}
                      — {p.name}
                      {p.category ? ` · ${p.category}` : ""}
                    </span>
                  </label>
                </div>
              ))}
              {filteredPermissions.length === 0 ? (
                <p className={styles.muted}>No permissions match.</p>
              ) : null}
            </div>
          )}
          <div className={styles.actions}>
            <button
              className={styles.button}
              type="submit"
              disabled={submitting || !canAssign || !editRoleId || !editEtag}
            >
              {submitting ? "Saving…" : `Save permissions (${selectedCodes.size})`}
            </button>
          </div>
        </form>
      </ForgePageSection>

      <ForgePageSection title="Assign role to user">
        <form className={styles.form} onSubmit={onAssign}>
          <div className={styles.formRow}>
            <label htmlFor="userId">User</label>
            <select
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              disabled={!canAssign}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.primaryEmail} ({u.status})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="assignRoleId">Role</label>
            <select
              id="assignRoleId"
              value={assignRoleId}
              onChange={(e) => setAssignRoleId(e.target.value)}
              required
              disabled={!canAssign}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="reason">Reason (optional)</label>
            <input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!canAssign}
            />
          </div>
          <div className={styles.actions}>
            <button
              className={styles.button}
              type="submit"
              disabled={submitting || !canAssign || !users.length || !roles.length}
            >
              {submitting ? "Assigning…" : "Assign"}
            </button>
          </div>
        </form>
      </ForgePageSection>

      <ForgePageSection title="Roles">
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && roles.length === 0 ? (
          <p className={styles.muted}>No roles for this tenant.</p>
        ) : null}
        {roles.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className={styles.mono}>{role.code}</td>
                  <td>{role.name}</td>
                  <td><ForgeStatusBadge status={role.status} /></td>
                  <td>{role.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <RolesInner />
    </Suspense>
  );
}
