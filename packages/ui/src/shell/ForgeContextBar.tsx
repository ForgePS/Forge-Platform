import type { ReactNode } from "react";

/** Compact customer/tenant context strip for customer-scoped Creator pages. */
export function ForgeContextBar({
  title,
  subtitle,
  status,
  meta,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="forge-context-bar">
      <div className="forge-context-bar__main">
        {icon ? <div className="forge-context-bar__icon">{icon}</div> : null}
        <div className="forge-context-bar__text">
          <div className="forge-context-bar__title-row">
            <span className="forge-context-bar__title">{title}</span>
            {status}
          </div>
          {subtitle ? <p className="forge-context-bar__subtitle">{subtitle}</p> : null}
          {meta ? <div className="forge-context-bar__meta">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="forge-context-bar__actions">{actions}</div> : null}
    </div>
  );
}
