import type { ReactNode } from "react";

export function ForgeSectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="forge-section-header">
      <div className="forge-section-header__text">
        <h2 className="forge-section-header__title">{title}</h2>
        {description ? <p className="forge-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="forge-section-header__actions">{actions}</div> : null}
    </div>
  );
}

export function ForgePageSection({
  children,
  title,
  description,
  actions,
  className,
  flush = false,
}: {
  children?: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Remove body padding when nesting tables/toolbars that provide their own spacing */
  flush?: boolean;
}) {
  return (
    <section
      className={["forge-page-section", flush ? "forge-page-section--flush" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      {title ? (
        <ForgeSectionHeader
          title={title}
          {...(description !== undefined ? { description } : {})}
          {...(actions !== undefined ? { actions } : {})}
        />
      ) : null}
      {children ? <div className="forge-page-section__body">{children}</div> : null}
    </section>
  );
}
