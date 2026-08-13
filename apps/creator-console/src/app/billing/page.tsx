"use client";

import Link from "next/link";
import { CreatorPage, ForgePageSection } from "@/components/creator-page";
import styles from "../page.module.css";

const BILLING_LINKS = [
  {
    href: "/billing/plans",
    title: "Plans",
    description: "Catalog reference and plan codes from current subscriptions.",
  },
  {
    href: "/subscriptions",
    title: "Subscriptions",
    description: "Active and historical customer subscriptions.",
  },
  {
    href: "/billing/invoices",
    title: "Invoices",
    description: "Invoice history when persistence is configured.",
  },
  {
    href: "/billing/renewals",
    title: "Renewals",
    description: "Upcoming renewals derived from subscription end dates.",
  },
  {
    href: "/billing/revenue",
    title: "Revenue",
    description: "Authoritative revenue reporting (when available).",
  },
] as const;

export default function BillingHubPage() {
  return (
    <CreatorPage
      title="Billing"
      subtitle="Plans, subscriptions, invoices, renewals, and revenue — linked surfaces only."
    >
      <ForgePageSection title="Billing surfaces">
        <ul className={styles.linkRow} style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {BILLING_LINKS.map((item) => (
            <li key={item.href} className={styles.panel} style={{ margin: 0 }}>
              <h2 style={{ marginTop: 0 }}>
                <Link href={item.href}>{item.title}</Link>
              </h2>
              <p className={styles.muted} style={{ marginBottom: 0 }}>
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </ForgePageSection>
    </CreatorPage>
  );
}
