"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { createImportApi, ImportCenterApp, type ImportWorkflowView } from "@forge/import-center";
import { CreatorLoading, CreatorPage } from "@/components/creator-page";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet, apiSend } from "@/lib/api";

function ImportsInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const api = useMemo(
    () =>
      createImportApi({
        get: (path, options) => apiGet(path, options),
        send: (path, method, payload, options) => apiSend(path, method, payload, options),
      }),
    [],
  );

  if (!tenantId) {
    return (
      <CreatorPage title="Imports">
        <TenantRequired />
      </CreatorPage>
    );
  }

  const jobId = searchParams.get("jobId");
  const view = searchParams.get("view") as ImportWorkflowView | null;

  return (
    <CreatorPage
      title="Imports"
      subtitle={<Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>}
      width="wide"
    >
      <ImportCenterApp
        api={api}
        tenantId={tenantId}
        hasPermission={hasPermission}
        basePath="/imports"
        initialJobId={jobId}
        initialView={view}
        appEnv={process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local"}
        LinkComponent={({ href, children }) => <Link href={href}>{children}</Link>}
        onNavigate={(href) => {
          const url = new URL(href, "http://local");
          const next = new URLSearchParams(url.search);
          if (tenantId && !next.get("tenantId")) next.set("tenantId", tenantId);
          router.push(`${url.pathname}?${next.toString()}`);
        }}
      />
    </CreatorPage>
  );
}

export default function ImportsPage() {
  return (
    <Suspense fallback={<CreatorLoading label="Loading Import Center…" />}>
      <ImportsInner />
    </Suspense>
  );
}
