"use client";

import { useId, useRef, useState } from "react";
import { apiSend } from "@/lib/api";
import styles from "../app/page.module.css";

type UploadInit = {
  assetId: string;
  url: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
};

export type ImageUploadProps = {
  tenantId: string;
  label: string;
  value: string;
  disabled?: boolean;
  helpText?: string;
  onChange: (url: string) => void;
};

async function verifyPublicUrl(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (res.ok) return true;
    } catch {
      // Network/CORS races — retry briefly while S3/API catch up.
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return false;
}

/**
 * Reusable image spot: init via API (small JSON), PUT file to S3, store public URL.
 * Avoids WAF SizeRestrictions_BODY on large base64 API posts.
 */
export function ImageUpload({
  tenantId,
  label,
  value,
  disabled,
  helpText,
  onChange,
}: ImageUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const init = await apiSend<UploadInit>(
        `/api/v1/tenants/${tenantId}/branding/assets/uploads`,
        "POST",
        {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSizeBytes: file.size,
        },
        { idempotencyKey: crypto.randomUUID() },
      );

      const put = await fetch(init.uploadUrl, {
        method: "PUT",
        headers: init.requiredHeaders,
        body: file,
      });
      if (!put.ok) {
        throw new Error(`S3 upload failed (${put.status})`);
      }

      // Accept immediately so the form does not flash empty while verify retries.
      onChange(init.url);

      const ok = await verifyPublicUrl(init.url);
      if (!ok) {
        setError(
          "Upload finished, but the public URL is not serving yet. Keep the URL, save draft, and retry preview in a moment.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.formRow}>
      <span className={styles.muted} style={{ display: "block", marginBottom: "0.25rem" }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        {value ? (
          <img
            src={value}
            alt=""
            style={{
              height: 48,
              width: "auto",
              maxWidth: 160,
              objectFit: "contain",
              background: "#fff",
              borderRadius: 8,
              border: "1px solid var(--forge-color-border)",
              padding: 4,
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              border: "1px dashed var(--forge-color-border)",
              display: "inline-block",
              background: "var(--forge-color-surface-2, #f5f5f9)",
            }}
          />
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          hidden
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
        <button
          type="button"
          className={styles.buttonSecondary}
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Upload image"}
        </button>
        {value ? (
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={disabled || busy}
            onClick={() => onChange("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      {helpText ? <span className={styles.muted}>{helpText}</span> : null}
      {error ? (
        <p role="alert" className={styles.error} style={{ marginBottom: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
