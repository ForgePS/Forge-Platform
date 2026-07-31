"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery } from "@/hooks/use-tenant-id";
import { STUDIO_NAMESPACES } from "@/components/config-studio";
import styles from "./page.module.css";

const LABELS: Record<string, string> = {
  tenant_profile: "Tenant Profile",
  organization_profile: "Organization Profile",
  branding: "Branding",
  navigation: "Navigation",
  terminology: "Terminology",
  dropdowns: "Dropdowns",
  notification_templates: "Notification templates",
  email_templates: "Email templates",
  business_hours: "Business hours",
  holiday_calendar: "Holiday calendar",
  facilities: "Facilities",
  locations: "Locations",
  roles: "Roles",
};

function HomeInner() {
  const { me, loading, error } = useAuth();
  const tenantId = me?.tenantId;

  return (
    <section className={styles.page}>
      <h1>Tenant Admin</h1>
      <p className={styles.lead}>
        Delegated Configuration Studio for your organization. Manage branding, navigation,
        templates, facilities, and other tenant-owned settings.
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading session…</p> : null}
      {tenantId ? (
        <p className={styles.muted}>
          Tenant <span className={styles.mono}>{tenantId}</span>
        </p>
      ) : !loading ? (
        <p className={styles.muted}>
          Sign in or append <code>?tenantId=…</code> to open Configuration Studio.
        </p>
      ) : null}

      <div className={styles.panel}>
        <h2>Quick links</h2>
        <p className={styles.linkRow}>
          <Link href={tenantId ? `/studio${tenantQuery(tenantId)}` : "/studio"}>
            Configuration Studio
          </Link>
        </p>
        <ul>
          {STUDIO_NAMESPACES.map((namespace) => (
            <li key={namespace}>
              <Link
                href={
                  tenantId
                    ? `/studio/${namespace.replace(/_/g, "-")}${tenantQuery(tenantId)}`
                    : `/studio/${namespace.replace(/_/g, "-")}`
                }
              >
                {LABELS[namespace] ?? namespace}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <HomeInner />
    </Suspense>
  );
}
