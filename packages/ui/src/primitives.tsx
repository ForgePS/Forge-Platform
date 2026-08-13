import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
}) {
  const variantClass =
    variant === "secondary"
      ? "forge-btn forge-btn--secondary"
      : variant === "danger"
        ? "forge-btn forge-btn--danger"
        : variant === "outline"
          ? "forge-btn forge-btn--outline"
          : variant === "ghost"
            ? "forge-btn forge-btn--ghost"
            : "forge-btn";
  return (
    <button
      type="button"
      className={[variantClass, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <input id={id} className={["forge-input", className].filter(Boolean).join(" ")} {...props} />
    </label>
  );
}

export function Select({
  label,
  id,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; children: ReactNode }) {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <select id={id} className={["forge-select", className].filter(Boolean).join(" ")} {...props}>
        {children}
      </select>
    </label>
  );
}

export function Textarea({
  label,
  id,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <textarea
        id={id}
        className={["forge-textarea", className].filter(Boolean).join(" ")}
        {...props}
      />
    </label>
  );
}

export function Checkbox({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <input id={id} type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Radio({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <input id={id} type="radio" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Alert({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "danger" | "success";
}) {
  return (
    <div role="alert" data-tone={tone} className={`forge-alert forge-alert--${tone}`}>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span data-component="badge">{children}</span>;
}

export function Card({
  children,
  title,
  className,
  variant = "standard",
  onClick,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
  variant?: "standard" | "interactive" | "selected";
  onClick?: () => void;
}) {
  const variantClass =
    variant === "interactive"
      ? "forge-card--interactive"
      : variant === "selected"
        ? "forge-card--selected"
        : null;
  const interactive = Boolean(onClick) || variant === "interactive" || variant === "selected";
  return (
    <section
      data-component="card"
      className={["forge-card", variantClass, className].filter(Boolean).join(" ")}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-interactive={interactive ? "true" : undefined}
    >
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="forge-card"
      style={{
        position: "fixed",
        inset: "20% 20%",
        zIndex: 50,
        boxShadow: "var(--forge-shadow-lg)",
      }}
    >
      <h2>{title}</h2>
      {children}
      <Button onClick={onClose} variant="secondary">
        Close
      </Button>
    </div>
  );
}

export function LoadingIndicator({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite">
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div data-component="empty-state" className="forge-card">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div role="alert" data-component="error-state" className="forge-alert forge-alert--danger">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function EnvironmentBanner({ environment }: { environment: string }) {
  if (environment === "production" || environment === "govcloud-production") {
    return null;
  }
  return (
    <Alert tone="danger">
      DEVELOPMENT ENVIRONMENT — DO NOT ENTER REAL PERSONNEL DATA ({environment})
    </Alert>
  );
}

export function FixtureBanner({
  children = "Development fixture data — not production",
}: {
  children?: ReactNode;
}) {
  const allow =
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_APP_ENV === "local" ||
      process.env.NEXT_PUBLIC_APP_ENV === "development" ||
      process.env.APP_ENV === "local" ||
      process.env.APP_ENV === "development");
  if (!allow) return null;
  return <div className="forge-fixture-banner">{children}</div>;
}

export function ForgeSkeleton({
  height = "1rem",
  width = "100%",
}: {
  height?: string;
  width?: string;
}) {
  return (
    <span className="forge-skeleton" style={{ display: "block", height, width }} aria-hidden />
  );
}
