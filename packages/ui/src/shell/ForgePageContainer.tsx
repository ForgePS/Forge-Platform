import type { ReactNode } from "react";

export function ForgePageContainer({
  children,
  className,
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  /** default ≈ 1440–1600px; form ≈ 800–1000px; wide for data-heavy tables */
  width?: "default" | "form" | "wide";
}) {
  const widthClass =
    width === "form"
      ? "forge-page-container--form"
      : width === "wide"
        ? "forge-page-container--wide"
        : "forge-page-container--default";
  return (
    <div className={["forge-page-container", widthClass, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
