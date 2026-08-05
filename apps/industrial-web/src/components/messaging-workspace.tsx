"use client";
import { useEffect, useState } from "react";
import { ApiError, apiGet, apiSend } from "@forge/web-kit";

type Thread = { id: string; title?: string; threadType: string; lastMessageAt?: string };
type Message = { id: string; body: string; senderName?: string; createdAt: string };

export function MessagingWorkspace({ moduleName }: { moduleName: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    apiGet<{ items: Thread[] }>("/api/v1/industrial/messaging/threads")
      .then((r) => setThreads(r.items))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Unable to load conversations"));
  }, []);
  async function open(id: string) {
    const thread = await apiGet<Thread & { messages: Message[] }>(
      `/api/v1/industrial/messaging/threads/${id}`,
    );
    setSelected(id);
    setMessages(thread.messages);
    await apiSend(`/api/v1/industrial/messaging/threads/${id}/read`, "POST", {});
  }
  async function send() {
    if (!selected || !body.trim()) return;
    await apiSend(`/api/v1/industrial/messaging/threads/${selected}/messages`, "POST", { body });
    setBody("");
    await open(selected);
  }
  return (
    <section className="ind-ops">
      <header className="ind-ops-header">
        <h1>{moduleName}</h1>
        <p>Tenant-scoped direct and group conversations.</p>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="ind-grid">
        <nav aria-label="Conversations">
          {threads.map((t) => (
            <button key={t.id} onClick={() => void open(t.id)}>
              {t.title ?? t.threadType}
            </button>
          ))}
        </nav>
        <div aria-live="polite">
          {messages.map((m) => (
            <article key={m.id}>
              <strong>{m.senderName ?? "User"}</strong>
              <p>{m.body}</p>
            </article>
          ))}
          {selected && (
            <div>
              <label>
                Message
                <input value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
              <button onClick={() => void send()}>Send</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
