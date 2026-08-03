import type { ReactNode } from "react";
import "@forge/design-system/styles.css";
import "@forge/fx-design-tokens/styles.css";
import "@forge/fx-ui/styles.css";
import "@forge/fx-layouts/styles.css";
import { AppShell } from "@/components/app-shell";
import { ApiBootstrap } from "@/components/api-bootstrap";

export const metadata = {
  title: "Forge RMS",
  description: "Manual NERIS incident reporting for fire and EMS agencies",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="forge-theme-light" data-fx-theme="light">
      <body>
        <ApiBootstrap>
          <AppShell>{children}</AppShell>
        </ApiBootstrap>
      </body>
    </html>
  );
}
