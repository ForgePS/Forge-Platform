import type { Metadata } from "next";
import "@forge/design-system/styles.css";
import { EnvironmentBanner } from "@forge/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge Academy (Foundation)",
  description: "Sprint 1B application shell",
};

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="forge-theme-light">
      <body>
        <EnvironmentBanner environment={appEnv} />
        <main>{children}</main>
      </body>
    </html>
  );
}
