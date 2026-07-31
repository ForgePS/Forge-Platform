import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Button({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

export function Input({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
    </label>
  );
}

export function Select({
  label,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; children: ReactNode }) {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <select id={id} {...props}>
        {children}
      </select>
    </label>
  );
}

export function Textarea({
  label,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} {...props} />
    </label>
  );
}

export function Checkbox({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id}>
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
    <label htmlFor={id}>
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
    <div role="alert" data-tone={tone}>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span data-component="badge">{children}</span>;
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section data-component="card">
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
    <div role="dialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2>
      {children}
      <Button onClick={onClose}>Close</Button>
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

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div data-component="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div role="alert" data-component="error-state">
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
