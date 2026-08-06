import type { ReactNode } from "react";
import "@forge/design-system/styles.css";
import { AppShell } from "@/components/app-shell";
import { ApiBootstrap } from "@/components/api-bootstrap";
import styles from "./shell.module.css";

export const metadata = {
  title: "Forge Creator Console",
  description: "Platform administration for Forge tenants",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="forge-theme-light">
      <body className={styles.body}>
        <ApiBootstrap>
          <AppShell>{children}</AppShell>
        </ApiBootstrap>
      </body>
    </html>
  );
}
