"use client";
import { useEffect, useState } from "react";
import { ApiError, apiGet, apiSend } from "@forge/web-kit";
import { EmptyState, PageHeader } from "@/components/layout/page-chrome";

type Thread = { id: string; title?: string; threadType: string; lastMessageAt?: string };
type Message = { id: string; body: string; senderName?: string; createdAt: string };

export function MessagingWorkspace({ moduleName }: { moduleName: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ items: Thread[] }>("/api/v1/industrial/messaging/threads")
      .then((r) => {
        setThreads(r.items);
        setError("");
      })
      .catch((e) => {
        setThreads([]);
        setError(e instanceof ApiError ? e.message : "Unable to load conversations");
      })
      .finally(() => setLoading(false));
  }, []);

  async function open(id: string) {
    try {
      const thread = await apiGet<Thread & { messages: Message[] }>(
        `/api/v1/industrial/messaging/threads/${id}`,
      );
      setSelected(id);
      setMessages(thread.messages);
      await apiSend(`/api/v1/industrial/messaging/threads/${id}/read`, "POST", {});
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to open conversation");
    }
  }

  async function send() {
    if (!selected || !body.trim()) return;
    try {
      await apiSend(`/api/v1/industrial/messaging/threads/${selected}/messages`, "POST", { body });
      setBody("");
      await open(selected);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to send message");
    }
  }

  return (
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Tenant-scoped direct and group conversations."
      />

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row g-4">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">Conversations</h5>
            </div>
            <div className="list-group list-group-flush">
              {loading ? (
                <div className="list-group-item text-muted">Loading…</div>
              ) : threads.length === 0 ? (
                <EmptyState
                  title="No conversations yet"
                  description="When conversations are started, they will appear here."
                />
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`list-group-item list-group-item-action ${selected === t.id ? "active" : ""}`}
                    onClick={() => void open(t.id)}
                  >
                    {t.title ?? t.threadType}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-0">Messages</h5>
            </div>
            <div className="card-body" aria-live="polite">
              {!selected ? (
                <p className="text-muted mb-0">Select a conversation to view messages.</p>
              ) : (
                <>
                  {messages.map((m) => (
                    <article key={m.id} className="mb-3">
                      <strong className="small">{m.senderName ?? "User"}</strong>
                      <p className="mb-0">{m.body}</p>
                    </article>
                  ))}
                  <div className="d-flex gap-2 mt-3">
                    <input
                      className="form-control form-control-sm"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      aria-label="Message"
                      placeholder="Write a message…"
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void send()}>
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
