"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";

type DocumentItem = { id: string; name: string; category?: string | null; status: string };

export function DocumentsWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await apiGet<DocumentItem[]>("/api/v1/documents"));
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load documents");
    }
  }

  useEffect(() => {
    if (permissions.has("documents.view")) void load();
  }, [me]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await apiSend("/api/v1/documents", "POST", { name, category: "INDUSTRIAL" });
      setName("");
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to create document");
    }
  }

  return (
    <section className="ind-ops">
      <header className="ind-ops-header">
        <h1>{moduleName}</h1>
        <p>Tenant-scoped shared documents with immutable versions, malware status, and short-lived delivery.</p>
      </header>
      {error && <p role="alert" className="ind-error">{error}</p>}
      {permissions.has("documents.upload") && (
        <form className="ind-form" onSubmit={(event) => void create(event)}>
          <label>Document name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <button type="submit">Create document</button>
        </form>
      )}
      <div className="ind-table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Status</th></tr></thead>
          <tbody>{items.map((item) => (
            <tr key={item.id}><td>{item.name}</td><td>{item.category ?? "—"}</td><td>{item.status}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
