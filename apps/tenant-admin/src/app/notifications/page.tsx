"use client";

import Link from "next/link";
import { Suspense } from "react";
import { TenantPageGate } from "@/components/tenant-page-gate";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import styles from "../page.module.css";

function NotificationsInner() {
  const tenantId = useTenantId();
  const q = tenantId ? tenantQuery(tenantId) : "";

  return (
    <section className={styles.page}>
      <h1>Notifications</h1>
      <p className={styles.lead}>
        Template configuration for this tenant. In-app notification inbox lands in MK-S13.
      </p>

      <div className={styles.panel}>
        <h2>Inbox</h2>
        <p className={styles.muted}>
          Unread count / mark-read surfaces are not enabled yet. Configure outbound templates in
          Studio.
        </p>
      </div>

      <nav className={styles.linkRow}>
        <Link href={`/studio/notification-templates${q}`}>Studio · Notification templates</Link>
        <Link href={`/studio/email-templates${q}`}>Studio · Email templates</Link>
      </nav>
    </section>
  );
}

export default function NotificationsPage() {
  return (
    <TenantPageGate
      title="Notifications"
      anyOf={["tenant.configuration.update", "platform.configuration.update"]}
    >
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <NotificationsInner />
      </Suspense>
    </TenantPageGate>
  );
}
