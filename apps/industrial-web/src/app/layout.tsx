import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@forge/design-system/styles.css";
import { ApiBootstrap } from "@/components/api-bootstrap";
import { IndustrialShell } from "@/components/industrial-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge Industrial Safety",
  description: "Forge Industrial Safety AWS application foundation (IND-1)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="forge-theme-light">
      <body>
        <ApiBootstrap>
          <IndustrialShell>{children}</IndustrialShell>
        </ApiBootstrap>
      </body>
    </html>
  );
}
