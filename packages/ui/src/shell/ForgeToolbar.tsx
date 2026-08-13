import type { ReactNode } from "react";

export function ForgeToolbar({
  children,
  actions,
  className,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={["forge-toolbar", className].filter(Boolean).join(" ")}>
      <div className="forge-toolbar__filters">{children}</div>
      {actions ? <div className="forge-toolbar__actions">{actions}</div> : null}
    </div>
  );
}
