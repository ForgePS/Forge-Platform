"use client";

import { useId, useState } from "react";

const MAX_BYTES = 450_000; // keep payloads modest for ops JSON storage

type Props = {
  label?: string;
  valueName?: string | null;
  valuePreviewUrl?: string | null;
  onChange: (next: { fileName: string; contentType: string; dataUrl: string } | null) => void;
  disabled?: boolean;
};

/**
 * Business-friendly photo picker — browse / camera, preview, remove.
 * No URL paste. Stores a data URL for ops payload until Industrial asset upload ships.
 */
export function LocalPhotoField({
  label = "Photo",
  valueName,
  valuePreviewUrl,
  onChange,
  disabled,
}: Props) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    setError(null);
    if (!file) {
      onChange(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (photo).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("This photo is larger than the allowed upload size. Try a smaller image.");
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    onChange({ fileName: file.name, contentType: file.type, dataUrl });
  }

  return (
    <div className="mb-2">
      <label className="form-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="form-control form-control-sm"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      <p className="form-text mb-1">Browse or take a photo. Do not paste a file link.</p>
      {error ? (
        <p className="text-danger small mb-1" role="alert">
          {error}
        </p>
      ) : null}
          {valuePreviewUrl ? (
        <div className="d-flex align-items-start gap-2 mt-2">
          <img
            src={valuePreviewUrl}
            alt={valueName ? `Preview of ${valueName}` : "Attachment preview"}
            className="rounded border"
            style={{ maxWidth: 160, maxHeight: 120, objectFit: "cover" }}
          />
          <div>
            <div className="small text-muted">{valueName ?? "Attached photo"}</div>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger mt-1"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}
