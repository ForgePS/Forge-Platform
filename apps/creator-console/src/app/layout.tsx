import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ApiBootstrap } from "@/components/api-bootstrap";
import { SneatHeadAssets } from "@/components/sneat-assets";
import "./globals.css";

export const metadata = {
  title: "Forge Creator Console",
  description: "Platform administration for Forge tenants",
  icons: { icon: "/sneat/img/favicon.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="light-style layout-menu-fixed"
      data-bs-theme="light"
      data-theme="theme-default"
      data-assets-path="/sneat/"
      data-template="vertical-menu-template-free"
    >
      <head>
        <SneatHeadAssets />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("forge-creator-theme-mode");var d=m==="dark";var r=document.documentElement;r.setAttribute("data-bs-theme",d?"dark":"light");r.classList.toggle("light-style",!d);r.classList.toggle("dark-style",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ApiBootstrap>
          <AppShell>{children}</AppShell>
        </ApiBootstrap>
      </body>
    </html>
  );
}
