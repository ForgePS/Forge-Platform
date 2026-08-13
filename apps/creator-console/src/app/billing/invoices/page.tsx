"use client";

import Link from "next/link";
import { CreatorPage, ForgePageSection } from "@/components/creator-page";
import styles from "../../page.module.css";

export default function BillingInvoicesPage() {
  return (
    <CreatorPage
      title="Invoices"
      subtitle={
        <>
          <Link href="/billing">Billing</Link>
          {" · Invoice history when persistence is configured"}
        </>
      }
    >
      <ForgePageSection title="Invoice list">
        <p className={styles.error} role="status">
          CONDITION: invoice persistence not configured.
        </p>
        <p className={styles.muted}>
          No invoice records are available in Creator Console until an invoice store is connected.
          This page does not invent sample invoices.
        </p>
      </ForgePageSection>
    </CreatorPage>
  );
}
