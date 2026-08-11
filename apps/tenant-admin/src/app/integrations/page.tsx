"use client";

import Link from "next/link";
import { Suspense } from "react";
import { TenantPageGate } from "@/components/tenant-page-gate";
import styles from "../page.module.css";

function IntegrationsInner() {
  return (
    <section className={styles.page}>
      <h1>Integrations</h1>
      <p className={styles.lead}>Outbound connections and webhooks for this tenant.</p>

      <div className={styles.panel}>
        <h2>Status</h2>
        <p className={styles.muted}>
          Integrations management (webhooks, delivery history) is scheduled for MK-S15. No
          configuration is editable here yet.
        </p>
      </div>

      <nav className={styles.linkRow}>
        <Link href="/api-access">API access</Link>
        <Link href="/audit">Audit</Link>
      </nav>
    </section>
  );
}

export default function IntegrationsPage() {
  return (
    <TenantPageGate title="Integrations" permission="platform.tenant.read">
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <IntegrationsInner />
      </Suspense>
    </TenantPageGate>
  );
}
