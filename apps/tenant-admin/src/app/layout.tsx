import type { ReactNode } from "react";
import "@forge/design-system/styles.css";
import { AppShell } from "@/components/app-shell";
import styles from "./shell.module.css";

export const metadata = {
  title: "Forge Tenant Admin",
  description: "Delegated Configuration Studio for Forge tenants",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
