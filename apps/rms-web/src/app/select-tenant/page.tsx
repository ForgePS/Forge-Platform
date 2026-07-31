"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@forge/web-kit";
import { FxTable } from "@/fx/tables/FxTable";
import { FxTableEmpty } from "@/fx/tables/FxTableStates";
import { TableSectionBoundary } from "@/fx/tables/TableSectionBoundary";
import { ensureTablesRegistered } from "@/fx/tables/register-all";
import { useRmsFxAdministrationModule } from "@/fx/modules/use-administration-module";
import styles from "../page.module.css";

export default function SelectTenantPage() {
  const router = useRouter();
  const { me, loading, error, chooseTenant } = useAuth();
  const { selectTenant: selectTenantMode, loading: moduleFlagLoading } =
    useRmsFxAdministrationModule();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    ensureTablesRegistered();
  }, []);

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

  const useFx = !moduleFlagLoading && selectTenantMode === "fx";
  const tenants = me?.tenants ?? [];

  return (
    <section
      className={styles.page}
      data-testid={useFx ? "rms-fx-select-tenant" : "rms-legacy-select-tenant"}
    >
      <h1>Select tenant</h1>
      <p className={styles.lead}>Choose the department tenant for this RMS session.</p>

      {error ? <p className={styles.error}>{error}</p> : null}
      {actionError ? <p className={styles.error}>{actionError}</p> : null}
      {loading ? <p className={styles.muted}>Loading tenants…</p> : null}

      {!loading && !me ? (
        <p>
          Not authenticated. <Link href="/login/">Sign in</Link> first.
        </p>
      ) : null}

      {me ? (
        useFx ? (
          <TableSectionBoundary title="Tenants">
            <FxTable
              caption="Available tenants"
              loading={false}
              empty={
                <FxTableEmpty
                  title="No tenants available."
                  description="Your account has no selectable department tenants."
                />
              }
              rows={tenants}
              rowKey={(row) => row.tenantId}
              columns={[
                { id: "displayName", header: "Display name", accessor: (row) => row.displayName },
                {
                  id: "slug",
                  header: "Slug",
                  accessor: (row) => <span className={styles.mono}>{row.slug}</span>,
                },
                { id: "status", header: "Status", accessor: (row) => row.tenantStatus },
                {
                  id: "current",
                  header: "Current",
                  accessor: (row) => (row.tenantId === me.tenantId ? "Yes" : "—"),
                },
              ]}
              rowActions={(row) => (
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={!row.selectable || busyId === row.tenantId}
                  onClick={() => void onSelect(row.tenantId)}
                >
                  {busyId === row.tenantId ? "Selecting…" : "Select"}
                </button>
              )}
            />
          </TableSectionBoundary>
        ) : (
          <div className={styles.panel}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Display name</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Current</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {me.tenants.map((tenant) => (
                  <tr key={tenant.tenantId}>
                    <td>{tenant.displayName}</td>
                    <td className={styles.mono}>{tenant.slug}</td>
                    <td>{tenant.tenantStatus}</td>
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
          </div>
        )
      ) : null}
    </section>
  );
}
