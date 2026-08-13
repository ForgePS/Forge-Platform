"use client";

import Link from "next/link";
import { CreatorPage, ForgePageSection } from "@/components/creator-page";
import styles from "../../page.module.css";

export default function BillingRevenuePage() {
  return (
    <CreatorPage
      title="Revenue"
      subtitle={
        <>
          <Link href="/billing">Billing</Link>
          {" · Authoritative revenue reporting"}
        </>
      }
    >
      <ForgePageSection title="Revenue overview">
        <p className={styles.error} role="status">
          CONDITION: no authoritative revenue API.
        </p>
        <p className={styles.muted}>
          Creator Console does not display estimated or fixture revenue figures. Connect an
          authoritative billing revenue source before enabling this view.
        </p>
      </ForgePageSection>
    </CreatorPage>
  );
}
