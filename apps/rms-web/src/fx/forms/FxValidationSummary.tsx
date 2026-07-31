"use client";

export function FxValidationSummary({
  title = "Please fix the following",
  errors,
}: {
  title?: string;
  errors: string[];
}) {
  if (errors.length === 0) return null;
  return (
    <div className="rms-fx-validation-summary" role="alert" tabIndex={-1}>
      <strong>{title}</strong>
      <ul>
        {errors.map((err) => (
          <li key={err}>{err}</li>
        ))}
      </ul>
    </div>
  );
}
