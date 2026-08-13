"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiSend } from "@forge/web-kit";

const categories = ["eap", "scenarios", "drills", "responseTeams", "jsas"] as const;
type RecordRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  planId?: string | null;
  eventDate?: string | null;
};

export function EmergencyResponseWorkspace({ moduleName }: { moduleName: string }) {
  const [category, setCategory] = useState<(typeof categories)[number]>("eap");
  const [items, setItems] = useState<RecordRow[]>([]);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [planId, setPlanId] = useState("");
  const [eventDate, setEventDate] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(
        (await apiGet<{ items: RecordRow[] }>(`/api/v1/industrial/emergency-response/${category}`))
          .items,
      );
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to load emergency response records");
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
    <section className="ind-ops">
      <header className="ind-ops-header">
        <h1>{moduleName}</h1>
        <p>
          Compliance plans, scenarios, drills, response teams, and JSAs. This is not a CAD or 911
          dispatch surface.
        </p>
      </header>
      <label>
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          aria-label="Emergency response category"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="ind-error">
          {error}
        </p>
      )}
      <form className="ind-form" onSubmit={(e) => void createRecord(e)}>
        <label>
          Title
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <label>
          Plan ID
          <input
            name="planId"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          Event date
          <input
            type="date"
            name="eventDate"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </label>
        <button type="submit">Create record</button>
      </form>
      <div className="ind-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Status</th>
              <th scope="col">Plan</th>
              <th scope="col">Event date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.status}</td>
                <td>{item.planId ?? "—"}</td>
                <td>{item.eventDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
