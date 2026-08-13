"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiSend } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";

const categories = ["eap", "scenarios", "drills", "responseTeams", "jsas"] as const;
type RecordRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  planId?: string | null;
  eventDate?: string | null;
};

const CATEGORY_LABELS: Record<(typeof categories)[number], string> = {
  eap: "Emergency action plans",
  scenarios: "Scenarios",
  drills: "Drills",
  responseTeams: "Response teams",
  jsas: "JSAs",
};

export function EmergencyResponseWorkspace({ moduleName }: { moduleName: string }) {
  const [category, setCategory] = useState<(typeof categories)[number]>("eap");
  const [items, setItems] = useState<RecordRow[]>([]);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [planId, setPlanId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        (await apiGet<{ items: RecordRow[] }>(`/api/v1/industrial/emergency-response/${category}`))
          .items,
      );
      setError("");
    } catch (e) {
      setItems([]);
      setError(e instanceof ApiError ? e.message : "Unable to load emergency response records");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRecord(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiSend(`/api/v1/industrial/emergency-response/${category}`, "POST", {
        title,
        status: "draft",
        planId: planId || undefined,
        eventDate: eventDate || undefined,
      });
      setTitle("");
      setPlanId("");
      setEventDate("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create record");
    }
  }

  return (
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Compliance plans, scenarios, drills, response teams, and JSAs. This is not a CAD or 911 dispatch surface."
      />

      <PageSection title="Filters" bodyClassName="pt-3">
        <div className="row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label" htmlFor="er-category">
              Category
            </label>
            <select
              id="er-category"
              className="form-select form-select-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              aria-label="Emergency response category"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </PageSection>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <PageSection title="Create record">
        <form className="row g-3" onSubmit={(e) => void createRecord(e)}>
          <div className="col-md-4">
            <label className="form-label" htmlFor="er-title">
              Title
            </label>
            <input
              id="er-title"
              className="form-control form-control-sm"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="er-plan">
              Plan ID
            </label>
            <input
              id="er-plan"
              className="form-control form-control-sm"
              name="planId"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="er-event">
              Event date
            </label>
            <input
              id="er-event"
              className="form-control form-control-sm"
              type="date"
              name="eventDate"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="col-md-1 d-flex align-items-end">
            <button type="submit" className="btn btn-primary btn-sm w-100">
              Create
            </button>
          </div>
        </form>
      </PageSection>

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">{CATEGORY_LABELS[category]}</h5>
        </div>
        {loading ? (
          <div className="card-body text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No records yet"
            description="Created emergency response records for this category will appear here."
          />
        ) : (
          <div className="table-responsive text-nowrap">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th scope="col">Record</th>
                  <th scope="col">Status</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Event date</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="fw-medium">{item.title}</td>
                    <td>
                      <span className="badge bg-label-secondary">{item.status}</span>
                    </td>
                    <td>{item.planId ?? "—"}</td>
                    <td>{item.eventDate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
