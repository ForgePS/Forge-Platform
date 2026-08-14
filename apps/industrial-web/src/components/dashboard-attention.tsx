"use client";

import Link from "next/link";

export type AttentionItem = {
  id: string;
  label: string;
  count: number | null;
  href: string;
  tone?: "warning" | "danger" | "info" | "secondary";
};

export type QuickAction = {
  id: string;
  label: string;
  href: string;
  available: boolean;
};

type Props = {
  attention: AttentionItem[];
  quickActions: QuickAction[];
  loading?: boolean;
};

/**
 * Classic Industrial home: what needs attention + permission-aware quick actions.
 * Sneat styling only — Firebase is workflow reference, not visual clone.
 */
export function DashboardAttention({ attention, quickActions, loading }: Props) {
  const visibleActions = quickActions.filter((a) => a.available);
  const hasCounts = attention.some((a) => a.count !== null && a.count > 0);

  return (
    <section className="mb-4" aria-labelledby="attention-heading">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h2 id="attention-heading" className="h5 mb-1">
            What needs my attention?
          </h2>
          <p className="text-muted small mb-0">
            Open work and upcoming due items across safety modules.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted small mb-3">Loading attention items…</p>
      ) : (
        <div className="d-flex flex-wrap gap-2 mb-4">
          {attention.map((item) => {
            const count = item.count;
            const show = count === null || count > 0 || !hasCounts;
            if (!show && count === 0) return null;
            const tone =
              item.tone === "danger"
                ? "bg-label-danger"
                : item.tone === "warning"
                  ? "bg-label-warning"
                  : item.tone === "info"
                    ? "bg-label-info"
                    : "bg-label-secondary";
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`badge ${tone} text-decoration-none px-3 py-2`}
              >
                <span className="fw-semibold">{item.label}</span>
                {count !== null ? (
                  <span className="ms-2">{count}</span>
                ) : (
                  <span className="ms-2 text-muted">—</span>
                )}
              </Link>
            );
          })}
          {attention.length === 0 ? (
            <p className="text-muted small mb-0">No attention items for this period.</p>
          ) : null}
        </div>
      )}

      <h3 className="h6 mb-2">Quick actions</h3>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {visibleActions.map((action) => (
          <Link key={action.id} href={action.href} className="btn btn-sm btn-primary">
            {action.label}
          </Link>
        ))}
        {visibleActions.length === 0 ? (
          <p className="text-muted small mb-0">No create actions available for your role.</p>
        ) : null}
      </div>
    </section>
  );
}
