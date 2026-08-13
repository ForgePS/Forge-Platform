"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ForgeContextBar,
  ForgePageContainer,
  ForgePageHeader,
  ForgePageSection,
  ForgeSkeleton,
  ForgeStatusBadge,
  ForgeTenantSwitcher,
  ForgeToolbar,
} from "@forge/ui";
import { useAuth } from "@/hooks/use-auth";
import { tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import { TenantRequired } from "@/components/tenant-required";
import { apiGet, apiSend } from "@/lib/api";

type ProductEntitlement = {
  id: string;
  status: string;
  productCode: string;
  productName: string;
};

type ModuleEntitlement = {
  id: string;
  status: string;
  moduleCode: string;
  moduleName: string;
};

type EntitlementsPayload = {
  products: ProductEntitlement[];
  modules: ModuleEntitlement[];
};

type CatalogProduct = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status?: string;
};

type CatalogModule = {
  id: string;
  code: string;
  name: string;
  productId: string;
  description?: string | null;
  status?: string;
  isCore?: boolean;
};

type TenantSummary = {
  id: string;
  displayName: string;
  status: string;
  slug: string;
  tenantKey: string;
};

const PRODUCT_ICONS: Record<string, string> = {
  FORGE_INDUSTRIAL: "IS",
  FORGE_RMS: "RM",
  FORGE_ACADEMY: "AC",
};

function productIcon(code: string): string {
  return PRODUCT_ICONS[code] ?? (code.slice(0, 2).toUpperCase() || "FP");
}

function isProductActive(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === "ACTIVE" || s === "ENTITLED";
}

function EntitlementsInner() {
  const router = useRouter();
  const tenantId = useTenantId();
  const { me, chooseTenant } = useAuth();

  const [data, setData] = useState<EntitlementsPayload | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogModules, setCatalogModules] = useState<CatalogModule[]>([]);
  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);
  const [moduleSearch, setModuleSearch] = useState("");
  const [moduleGroupFilter, setModuleGroupFilter] = useState<"all" | "core" | "optional">("all");
  const [moduleStatusFilter, setModuleStatusFilter] = useState<"all" | "enabled" | "disabled">(
    "all",
  );

  const tenants =
    me?.tenants.map((t) => ({
      tenantId: t.tenantId,
      displayName: t.displayName,
      selectable: t.selectable,
    })) ?? [];

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [entitlements, products, modules, tenantRow] = await Promise.all([
        apiGet<EntitlementsPayload>(`/api/v1/tenants/${tenantId}/entitlements`),
        apiGet<CatalogProduct[]>("/api/v1/platform/products"),
        apiGet<CatalogModule[]>("/api/v1/platform/modules"),
        apiGet<TenantSummary>(`/api/v1/platform/tenants/${tenantId}`).catch(() => null),
      ]);
      setData(entitlements);
      setCatalogProducts(products);
      setCatalogModules(modules);
      setTenant(tenantRow);
      setSelectedProductCode((current) => {
        if (current && products.some((p) => p.code === current)) return current;
        const active = entitlements.products.find((p) => isProductActive(p.status));
        return active?.productCode ?? products[0]?.code ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load products and modules.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const entitlementByProduct = useMemo(() => {
    const map = new Map<string, ProductEntitlement>();
    for (const row of data?.products ?? []) map.set(row.productCode, row);
    return map;
  }, [data]);

  const entitlementByModule = useMemo(() => {
    const map = new Map<string, ModuleEntitlement>();
    for (const row of data?.modules ?? []) map.set(row.moduleCode, row);
    return map;
  }, [data]);

  const selectedProduct = catalogProducts.find((p) => p.code === selectedProductCode) ?? null;
  const selectedEntitlement = selectedProductCode
    ? entitlementByProduct.get(selectedProductCode)
    : undefined;
  const selectedActive = isProductActive(selectedEntitlement?.status);

  const productModules = useMemo(() => {
    if (!selectedProduct) return [];
    return catalogModules.filter((m) => m.productId === selectedProduct.id);
  }, [catalogModules, selectedProduct]);

  const enabledModuleCount = useMemo(() => {
    return productModules.filter((m) => isProductActive(entitlementByModule.get(m.code)?.status))
      .length;
  }, [productModules, entitlementByModule]);

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    return productModules.filter((m) => {
      const ent = entitlementByModule.get(m.code);
      const enabled = isProductActive(ent?.status);
      if (moduleGroupFilter === "core" && !m.isCore) return false;
      if (moduleGroupFilter === "optional" && m.isCore) return false;
      if (moduleStatusFilter === "enabled" && !enabled) return false;
      if (moduleStatusFilter === "disabled" && enabled) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [
    productModules,
    entitlementByModule,
    moduleSearch,
    moduleGroupFilter,
    moduleStatusFilter,
  ]);

  const coreModules = filteredModules.filter((m) => m.isCore);
  const optionalModules = filteredModules.filter((m) => !m.isCore);

  async function switchCustomer(nextTenantId: string) {
    await chooseTenant(nextTenantId);
    router.push(`/entitlements?tenantId=${encodeURIComponent(nextTenantId)}`);
  }

  async function setProductStatus(productCode: string, status: "ACTIVE" | "DISABLED") {
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiSend(`/api/v1/tenants/${tenantId}/products/${productCode}`, "PUT", { status });
      await load();
      setSelectedProductCode(productCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSubmitting(false);
    }
  }

  async function setModuleStatus(moduleCode: string, status: "ACTIVE" | "SUSPENDED") {
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiSend(`/api/v1/tenants/${tenantId}/modules/${moduleCode}/entitlement`, "PUT", {
        status,
      });
      const entitlements = await apiGet<EntitlementsPayload>(
        `/api/v1/tenants/${tenantId}/entitlements`,
      );
      setData(entitlements);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update module");
    } finally {
      setSubmitting(false);
    }
  }

  async function enableAllVisible() {
    for (const mod of filteredModules) {
      if (!isProductActive(entitlementByModule.get(mod.code)?.status)) {
        await setModuleStatus(mod.code, "ACTIVE");
      }
    }
  }

  function renderModuleGroup(title: string, rows: CatalogModule[]) {
    if (rows.length === 0) return null;
    return (
      <div style={{ marginBottom: "1rem" }}>
        <h3
          style={{
            margin: "0 0 0.5rem",
            fontSize: "0.8rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--forge-color-muted)",
          }}
        >
          {title}
        </h3>
        <div className="forge-module-list">
          {rows.map((mod) => {
            const ent = entitlementByModule.get(mod.code);
            const enabled = isProductActive(ent?.status);
            return (
              <div key={mod.id} className="forge-module-row">
                <div>
                  <div className="forge-module-row__name">{mod.name}</div>
                  <div className="forge-module-row__meta">
                    {mod.isCore ? "Core" : "Optional"}
                    {ent?.status ? ` · ${ent.status === "ACTIVE" ? "Enabled" : "Not enabled"}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <ForgeStatusBadge
                    status={enabled ? "ACTIVE" : "INACTIVE"}
                    label={enabled ? "Enabled" : "Not enabled"}
                  />
                  <Button
                    type="button"
                    variant={enabled ? "secondary" : "primary"}
                    disabled={submitting || !selectedActive}
                    onClick={() =>
                      void setModuleStatus(mod.code, enabled ? "SUSPENDED" : "ACTIVE")
                    }
                  >
                    {enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <ForgePageContainer>
        <ForgePageHeader
          title="Products & Modules"
          subtitle="Select a customer to configure product and module access."
        />
        <TenantRequired />
      </ForgePageContainer>
    );
  }

  const customerName =
    tenant?.displayName ??
    tenants.find((t) => t.tenantId === tenantId)?.displayName ??
    "Customer";

  return (
    <ForgePageContainer>
      <ForgePageHeader
        title="Products & Modules"
        subtitle={`Configure the Forge products and modules available to ${customerName}.`}
        actions={
          <>
            <Link className="forge-btn forge-btn--secondary" href={tenantDetailHref(tenantId)}>
              Back to Customer
            </Link>
            <ForgeTenantSwitcher
              label="Customer"
              tenants={tenants}
              activeTenantId={tenantId}
              onSelect={(id) => void switchCustomer(id)}
              disabled={submitting}
            />
          </>
        }
      />

      <ForgeContextBar
        title={customerName}
        status={tenant ? <ForgeStatusBadge status={tenant.status} /> : undefined}
        subtitle={
          selectedActive && selectedProduct
            ? `${selectedProduct.name} · ${enabledModuleCount} modules enabled`
            : "No product selected for module management"
        }
        meta={
          tenant?.slug ? (
            <span>{tenant.slug}.forgepublicsafety.com</span>
          ) : undefined
        }
        icon={<span aria-hidden>{productIcon(selectedProductCode ?? "")}</span>}
        actions={
          <Link className="forge-btn forge-btn--outline" href={tenantDetailHref(tenantId)}>
            Open Customer
          </Link>
        }
      />

      {error ? (
        <ErrorState title="Something went wrong" description={error} />
      ) : null}

      {loading ? (
        <ForgePageSection title="Products">
          <ForgeSkeleton height="6rem" />
        </ForgePageSection>
      ) : (
        <>
          <ForgePageSection
            title="Products"
            description="Enable a product for this customer, then manage its modules."
          >
            {catalogProducts.length === 0 ? (
              <EmptyState
                title="No products in catalog"
                description="Platform products will appear here once the catalog is seeded."
              />
            ) : (
              <div className="forge-product-grid">
                {catalogProducts.map((product) => {
                  const ent = entitlementByProduct.get(product.code);
                  const active = isProductActive(ent?.status);
                  const selected = product.code === selectedProductCode;
                  const modsForProduct = catalogModules.filter((m) => m.productId === product.id);
                  const enabledCount = modsForProduct.filter((m) =>
                    isProductActive(entitlementByModule.get(m.code)?.status),
                  ).length;
                  return (
                    <Card
                      key={product.id}
                      className="forge-product-card"
                      variant={selected ? "selected" : "interactive"}
                      onClick={() => setSelectedProductCode(product.code)}
                    >
                      <div className="forge-product-card__top">
                        <div className="forge-product-card__icon" aria-hidden>
                          {productIcon(product.code)}
                        </div>
                        <div>
                          <h3 className="forge-product-card__name">{product.name}</h3>
                          <ForgeStatusBadge
                            status={active ? "ACTIVE" : "INACTIVE"}
                            label={active ? "Active" : "Not enabled"}
                          />
                        </div>
                      </div>
                      <p className="forge-product-card__meta">
                        {active
                          ? `${enabledCount} of ${modsForProduct.length} modules enabled`
                          : product.description || "Not enabled for this customer"}
                      </p>
                      <div className="forge-product-card__actions">
                        {active ? (
                          <Button
                            type="button"
                            variant="primary"
                            disabled={submitting}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProductCode(product.code);
                            }}
                          >
                            Manage Modules
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            disabled={submitting}
                            onClick={(e) => {
                              e.stopPropagation();
                              void setProductStatus(product.code, "ACTIVE");
                            }}
                          >
                            Add Product
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </ForgePageSection>

          {selectedProduct ? (
            <ForgePageSection
              title={selectedProduct.name}
              description={
                selectedActive
                  ? `${enabledModuleCount} of ${productModules.length} available modules selected`
                  : "Enable this product to manage modules."
              }
              actions={
                selectedActive ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={submitting}
                    onClick={() => void setProductStatus(selectedProduct.code, "DISABLED")}
                  >
                    Disable Product
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={submitting}
                    onClick={() => void setProductStatus(selectedProduct.code, "ACTIVE")}
                  >
                    Add Product
                  </Button>
                )
              }
            >
              {selectedActive ? (
                <>
                  <ForgeToolbar
                    actions={
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={submitting || filteredModules.length === 0}
                        onClick={() => void enableAllVisible()}
                      >
                        Select All Available
                      </Button>
                    }
                  >
                    <input
                      className="forge-input"
                      type="search"
                      placeholder="Search modules..."
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                      aria-label="Search modules"
                    />
                    <select
                      className="forge-select"
                      aria-label="Category"
                      value={moduleGroupFilter}
                      onChange={(e) =>
                        setModuleGroupFilter(e.target.value as "all" | "core" | "optional")
                      }
                      style={{ width: "auto", minWidth: "9rem", marginTop: 0 }}
                    >
                      <option value="all">All categories</option>
                      <option value="core">Core</option>
                      <option value="optional">Optional</option>
                    </select>
                    <select
                      className="forge-select"
                      aria-label="Status"
                      value={moduleStatusFilter}
                      onChange={(e) =>
                        setModuleStatusFilter(e.target.value as "all" | "enabled" | "disabled")
                      }
                      style={{ width: "auto", minWidth: "9rem", marginTop: 0 }}
                    >
                      <option value="all">All statuses</option>
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Not enabled</option>
                    </select>
                  </ForgeToolbar>

                  {filteredModules.length === 0 ? (
                    <EmptyState
                      title="No modules match"
                      description="Try adjusting search or filters."
                    />
                  ) : (
                    <>
                      {renderModuleGroup("Core modules", coreModules)}
                      {renderModuleGroup("Optional modules", optionalModules)}
                    </>
                  )}
                </>
              ) : (
                <EmptyState
                  title="Product not enabled"
                  description={`Add ${selectedProduct.name} to configure modules for this customer.`}
                  action={
                    <Button
                      type="button"
                      variant="primary"
                      disabled={submitting}
                      onClick={() => void setProductStatus(selectedProduct.code, "ACTIVE")}
                    >
                      Add Product
                    </Button>
                  }
                />
              )}

              <details className="forge-advanced-details">
                <summary>Advanced Details</summary>
                <p style={{ fontSize: "0.85rem", color: "var(--forge-color-muted)" }}>
                  Customer ID: <code>{tenantId}</code>
                  {tenant?.tenantKey ? (
                    <>
                      <br />
                      Tenant key: <code>{tenant.tenantKey}</code>
                    </>
                  ) : null}
                  <br />
                  Product code: <code>{selectedProduct.code}</code>
                </p>
              </details>
            </ForgePageSection>
          ) : null}
        </>
      )}
    </ForgePageContainer>
  );
}

export default function EntitlementsPage() {
  return (
    <Suspense
      fallback={
        <ForgePageContainer>
          <ForgeSkeleton height="2rem" width="16rem" />
        </ForgePageContainer>
      }
    >
      <EntitlementsInner />
    </Suspense>
  );
}
