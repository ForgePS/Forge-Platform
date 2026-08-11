"use client";
import { useEffect, useState } from "react";
import { ApiError, apiGet, apiSend } from "@forge/web-kit";

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

  async function load() {
    try {
      const q = filter ? `?q=${encodeURIComponent(filter)}` : "";
      setItems((await apiGet<{ items: Task[] }>(`/api/v1/industrial/tasks${q}`)).items);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to load tasks");
    }
  }

  useEffect(() => {
    void load();
    // initial mount load only; filter applied via explicit refresh/actions
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
    await apiSend(`/api/v1/industrial/tasks/${task.id}/${action}`, "POST", {});
    await load();
  }

  return (
    <section className="ind-ops">
      <header className="ind-ops-header">
        <h1>{moduleName}</h1>
        <p>Assigned work, acknowledgements, and completion tracking.</p>
      </header>
      {error && (
        <p role="alert" className="ind-error">
          {error}
        </p>
      )}
      <form className="ind-form" onSubmit={(e) => void createTask(e)}>
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
          Priority
          <select
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            aria-label="Task priority"
          >
            {["Low", "Medium", "High", "Urgent"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due date
          <input
            type="date"
            name="deadlineDate"
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
          />
        </label>
        <button type="submit">Create task</button>
      </form>
      <div className="ind-toolbar">
        <label>
          Search
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Search tasks"
          />
        </label>
        <button type="button" onClick={() => void load()}>
          Apply
        </button>
      </div>
      <div className="ind-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Priority</th>
              <th scope="col">Due</th>
              <th scope="col">Status</th>
              <th scope="col">Assignee</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => (
              <tr key={task.id}>
                <td>
                  {task.title}
                  {task.overdue ? " (Overdue)" : ""}
                </td>
                <td>{task.priority}</td>
                <td>{task.deadlineDate ?? "—"}</td>
                <td>{task.status}</td>
                <td>{task.assigneeName ?? "Unassigned"}</td>
                <td>
                  {!["completed", "cancelled"].includes(task.status) && (
                    <button type="button" onClick={() => void transition(task)}>
                      Advance
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
