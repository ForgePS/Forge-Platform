import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  as: Heading = "h4",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  as?: "h1" | "h4";
}) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <Heading className="fw-bold mb-1">{title}</Heading>
        {description ? <p className="text-muted mb-0 small">{description}</p> : null}
      </div>
      {actions ? <div className="d-flex flex-wrap gap-2 align-items-center">{actions}</div> : null}
    </div>
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={["card mb-4", className].filter(Boolean).join(" ")}>
      {title ? (
        <div className="card-header d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h5 className="card-title mb-0">{title}</h5>
            {description ? <small className="text-muted">{description}</small> : null}
          </div>
          {actions ? <div className="d-flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={["card-body", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
    </div>
  );
}

export function Toolbar({
  children,
  actions,
}: {
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
      <div className="d-flex flex-wrap gap-2 align-items-end flex-grow-1">{children}</div>
      {actions ? <div className="d-flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-4 px-3">
      <p className="fw-semibold mb-1">{title}</p>
      {description ? <p className="text-muted small mb-3">{description}</p> : null}
      {action}
    </div>
  );
}
