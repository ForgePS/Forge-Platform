"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  ErrorState,
  FilterBar,
  ForgePageActions,
  ForgePageHeader,
  LoadingState,
  Pagination,
  SearchInput,
  StatusBadge,
} from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type Tenant = {
  id: string;
  tenantKey: string;
  slug: string;
  displayName: string;
  legalName: string;
  status: string;
  tenantType: string;
  createdAt?: string;
  updatedAt?: string;
  primaryDomain?: string | null;
};

const PAGE_SIZE = 10;

function CustomersInner() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenants(await apiGet<Tenant[]>("/api/v1/platform/tenants"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!needle) return true;
      return [t.displayName, t.legalName, t.tenantKey, t.slug, t.primaryDomain ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [tenants, search, statusFilter]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title="Customers"
        subtitle="Platform tenants managed as customer accounts."
        actions={
          <ForgePageActions>
            <Link className="forge-btn" href="/customers/new/">
              Add customer
            </Link>
            <Link className="forge-btn forge-btn--outline" href="/tenants/">
              Legacy tenants view
            </Link>
          </ForgePageActions>
        }
      />

      {error ? <ErrorState title="Unable to load customers" description={error} /> : null}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search customers…" />
        <label className="forge-search-input" htmlFor="status-filter">
          <span className="forge-search-input__label">Status</span>
          <select
            id="status-filter"
            className="forge-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="TRIAL">TRIAL</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="ONBOARDING">ONBOARDING</option>
          </select>
        </label>
      </FilterBar>

      {loading ? <LoadingState label="Loading customers…" /> : null}
      {!loading && filtered.length === 0 ? (
        <EmptyState
          title="No customers match"
          description="Adjust filters or add a new customer."
          action={
            <Link className="forge-btn" href="/customers/new/">
              Add customer
            </Link>
          }
        />
      ) : null}

      {pageItems.length > 0 ? (
        <>
          <div className={styles.panel} style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Products</th>
                  <th>Facilities</th>
                  <th>Users</th>
                  <th>Domain</th>
                  <th>Created</th>
                  <th>Last activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <Link href={tenantDetailHref(tenant.id)}>{tenant.displayName}</Link>
                      <div className={styles.muted}>{tenant.tenantKey}</div>
                    </td>
                    <td>
                      <StatusBadge tone={tenant.status === "ACTIVE" ? "success" : tenant.status === "SUSPENDED" ? "danger" : "info"}>
                        {tenant.status}
                      </StatusBadge>
                    </td>
                    <td className={styles.muted}>Not available</td>
                    <td className={styles.muted}>Not available</td>
                    <td className={styles.muted}>Not available</td>
                    <td>{tenant.primaryDomain ?? tenant.slug}</td>
                    <td className={styles.mono}>{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "Not available"}</td>
                    <td className={styles.mono}>{tenant.updatedAt ? new Date(tenant.updatedAt).toLocaleDateString() : "Not available"}</td>
                    <td>
                      <Link href={tenantDetailHref(tenant.id)}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      ) : null}
    </section>
  );
}

export default function CustomersPage() {
  return (
    <PlatformPageGate title="Customers" permission="platform.tenant.read">
      <CustomersInner />
    </PlatformPageGate>
  );
}
