"use client";

import Link from "next/link";
import { Suspense } from "react";
import { TenantPageGate } from "@/components/tenant-page-gate";
import styles from "../page.module.css";

function ApiAccessInner() {
  return (
    <section className={styles.page}>
      <h1>API</h1>
      <p className={styles.lead}>Tenant API keys and programmatic access.</p>

      <div className={styles.panel}>
        <h2>API keys</h2>
        <p className={styles.muted}>
          Server-generated keys (`forge_live_` prefix, hashed secrets, scopes) land in MK-S15. This
          page establishes the admin surface and permission gate only.
        </p>
      </div>

      <nav className={styles.linkRow}>
        <Link href="/integrations">Integrations</Link>
        <Link href="/security">Security</Link>
      </nav>
    </section>
  );
}

export default function ApiAccessPage() {
  return (
    <TenantPageGate title="API" permission="platform.tenant.read">
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <ApiAccessInner />
      </Suspense>
    </TenantPageGate>
  );
}
