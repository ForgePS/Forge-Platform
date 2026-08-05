"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="ind-state" role="alert">
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred in Forge Industrial Safety.</p>
      <p className="ind-muted">Correlation: {error.digest ?? "local"}</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
