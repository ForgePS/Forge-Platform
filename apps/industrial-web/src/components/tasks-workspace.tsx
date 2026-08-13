"use client";
import { useEffect, useState } from "react";
import { ApiError, apiGet, apiSend } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  overdue?: boolean;
  assigneeName?: string | null;
  deadlineDate?: string | null;
};

export function TasksWorkspace({ moduleName }: { moduleName: string }) {
  const [items, setItems] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const q = filter ? `?q=${encodeURIComponent(filter)}` : "";
      setItems((await apiGet<{ items: Task[] }>(`/api/v1/industrial/tasks${q}`)).items);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to load tasks");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiSend("/api/v1/industrial/tasks", "POST", {
        title,
        priority,
        deadlineDate: deadlineDate || undefined,
        status: "assigned",
      });
      setTitle("");
      setDeadlineDate("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create task");
    }
  }

  async function transition(task: Task) {
    const action =
      task.status === "assigned"
        ? "acknowledge"
        : task.status === "acknowledged"
          ? "start"
          : "complete";
    try {
      await apiSend(`/api/v1/industrial/tasks/${task.id}/${action}`, "POST", {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to advance task");
    }
  }

  return (
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Assigned work, acknowledgements, and completion tracking."
      />

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
          {!error.toLowerCase().includes("unable") ? null : (
            <span className="d-block small mt-1">
              If this module API is not provisioned yet, records will appear once the endpoint is
              live.
            </span>
          )}
        </div>
      ) : null}

      <PageSection title="Create task">
        <form className="row g-3" onSubmit={(e) => void createTask(e)}>
          <div className="col-md-5">
            <label className="form-label" htmlFor="task-title">
              Title
            </label>
            <input
              id="task-title"
              className="form-control form-control-sm"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="task-priority">
              Priority
            </label>
            <select
              id="task-priority"
              className="form-select form-select-sm"
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {["Low", "Medium", "High", "Urgent"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="task-due">
              Due date
            </label>
            <input
              id="task-due"
              className="form-control form-control-sm"
              type="date"
              name="deadlineDate"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
            />
          </div>
          <div className="col-md-1 d-flex align-items-end">
            <button type="submit" className="btn btn-primary btn-sm w-100">
              Add
            </button>
          </div>
        </form>
      </PageSection>

      <div className="card">
        <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
          <h5 className="card-title mb-0">Tasks</h5>
          <div className="d-flex gap-2">
            <input
              className="form-control form-control-sm"
              style={{ minWidth: "10rem" }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Search tasks"
              placeholder="Search…"
            />
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void load()}>
              Apply
            </button>
          </div>
        </div>
        {loading ? (
          <div className="card-body text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState title="No tasks yet" description="Created tasks for this tenant will appear here." />
        ) : (
          <div className="table-responsive text-nowrap">
            <table className="table table-hover table-sm mb-0">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {items.map((task) => (
                  <tr key={task.id}>
                    <td className="fw-medium">
                      {task.title}
                      {task.overdue ? (
                        <span className="badge bg-label-danger ms-2">Overdue</span>
                      ) : null}
                    </td>
                    <td>{task.priority}</td>
                    <td>{task.deadlineDate ?? "—"}</td>
                    <td>
                      <span className="badge bg-label-secondary">{task.status}</span>
                    </td>
                    <td>{task.assigneeName ?? "Unassigned"}</td>
                    <td>
                      {!["completed", "cancelled"].includes(task.status) ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => void transition(task)}
                        >
                          Advance
                        </button>
                      ) : null}
                    </td>
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
