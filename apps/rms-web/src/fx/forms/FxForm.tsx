"use client";

import type { FormHTMLAttributes, ReactNode } from "react";
import { FormSectionBoundary } from "./FormSectionBoundary";

export function FxForm({
  title,
  description,
  children,
  ...rest
}: FormHTMLAttributes<HTMLFormElement> & {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <form className="rms-fx-form" data-testid="rms-fx-form" {...rest}>
      {title ? <h1 className="rms-fx-form__title">{title}</h1> : null}
      {description ? <p className="rms-fx-form__lead">{description}</p> : null}
      <FormSectionBoundary title="Form">{children}</FormSectionBoundary>
    </form>
  );
}

export function FxFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rms-fx-form__section" aria-labelledby={`fx-form-section-${title}`}>
      <h2 id={`fx-form-section-${title}`} className="rms-fx-form__section-title">
        {title}
      </h2>
      {description ? <p className="rms-fx-form__lead">{description}</p> : null}
      <FormSectionBoundary title={title}>{children}</FormSectionBoundary>
    </section>
  );
}

export function FxFormGrid({
  columns = 2,
  children,
}: {
  columns?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return <div className={`rms-fx-form__grid rms-fx-form__grid--${columns}`}>{children}</div>;
}
