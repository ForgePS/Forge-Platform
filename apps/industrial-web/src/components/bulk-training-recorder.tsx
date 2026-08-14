"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@forge/web-kit";
import { EmptyState, PageSection } from "@/components/layout/page-chrome";
import { friendlyActionError, friendlyLoadError } from "@/lib/friendly-error";

type Person = {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  employeeNumber?: string;
  status?: string;
};

type Props = {
  canManage: boolean;
  onCreated?: () => void;
};

/**
 * Record the same training class for many employees in one action.
 */
export function BulkTrainingRecorder({ canManage, onCreated }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [completedOn, setCompletedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ items: Person[] }>("/api/v1/industrial/personnel", {
          query: { page: "1", pageSize: "100", status: "ACTIVE" },
        });
        if (!cancelled) setPeople(data.items ?? []);
      } catch (e) {
        if (!cancelled) setError(friendlyLoadError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((p) => {
      const name = String(p.displayName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`).toLowerCase();
      const num = String(p.employeeNumber ?? "").toLowerCase();
      return name.includes(needle) || num.includes(needle);
    });
  }, [people, q]);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  async function submit() {
    if (!canManage) return;
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError("Enter a course or training title.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Select at least one employee.");
      return;
    }
    setBusy(true);
    try {
      let created = 0;
      for (const id of selectedIds) {
        const person = people.find((p) => p.id === id);
        const assigneeName =
          person?.displayName ??
          `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim() ??
          "Employee";
        await apiSend("/api/v1/industrial/training", "POST", {
          title: title.trim(),
          courseCode: courseCode.trim() || undefined,
          instructorName: instructorName.trim() || undefined,
          assigneeName,
          personnelId: id,
          employeeNumber: person?.employeeNumber || undefined,
          completedOn: completedOn || undefined,
          location: location.trim() || undefined,
          completionStatus: "Complete",
          status: "COMPLETE",
        });
        created += 1;
      }
      setSuccess(`Recorded training for ${created} employee${created === 1 ? "" : "s"}.`);
      setSelected({});
      onCreated?.();
    } catch (e) {
      setError(friendlyActionError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <p className="text-muted small mb-0">
        Recording training for multiple employees requires training manage permission.
      </p>
    );
  }

  return (
    <PageSection
      title="Record training"
      description="Select a course and multiple employees — one class, one save."
      className="mb-4"
    >
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      ) : null}

      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="bulk-training-title">
            Course
          </label>
          <input
            id="bulk-training-title"
            className="form-control form-control-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Forklift Operator"
            required
          />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="bulk-training-date">
            Date
          </label>
          <input
            id="bulk-training-date"
            className="form-control form-control-sm"
            type="date"
            value={completedOn}
            onChange={(e) => setCompletedOn(e.target.value)}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="bulk-training-code">
            Course code
          </label>
          <input
            id="bulk-training-code"
            className="form-control form-control-sm"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bulk-training-instructor">
            Instructor
          </label>
          <input
            id="bulk-training-instructor"
            className="form-control form-control-sm"
            value={instructorName}
            onChange={(e) => setInstructorName(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="bulk-training-location">
            Location
          </label>
          <input
            id="bulk-training-location"
            className="form-control form-control-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Main Plant"
          />
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-2">
        <div className="flex-grow-1" style={{ minWidth: "12rem" }}>
          <label className="form-label" htmlFor="bulk-training-search">
            Employees
          </label>
          <input
            id="bulk-training-search"
            className="form-control form-control-sm"
            type="search"
            placeholder="Search name or employee number"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const p of filtered) next[p.id] = true;
              setSelected((prev) => ({ ...prev, ...next }));
            }}
          >
            Select shown
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setSelected({})}
          >
            Clear
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No employees found"
          description="Add people in Personnel, then return here to record class attendance."
        />
      ) : (
        <div className="table-responsive border rounded mb-3" style={{ maxHeight: 280 }}>
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th style={{ width: "2.5rem" }} />
                <th>Employee</th>
                <th>Employee #</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const name =
                  p.displayName ??
                  (`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Employee");
                return (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={Boolean(selected[p.id])}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [p.id]: e.target.checked }))
                        }
                        aria-label={`Select ${name}`}
                      />
                    </td>
                    <td>{name}</td>
                    <td className="text-muted">{p.employeeNumber ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={busy || selectedIds.length === 0 || !title.trim()}
        onClick={() => void submit()}
      >
        {busy
          ? "Recording…"
          : `Record training (${selectedIds.length} employee${selectedIds.length === 1 ? "" : "s"})`}
      </button>
    </PageSection>
  );
}
