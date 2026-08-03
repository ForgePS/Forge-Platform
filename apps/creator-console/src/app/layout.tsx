import type { ReactNode } from "react";
import "@forge/design-system/styles.css";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Forge Creator Console",
  description: "Platform administration for Forge tenants",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="forge-theme-light">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
