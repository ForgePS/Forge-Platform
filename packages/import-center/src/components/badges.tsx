import type { CSSProperties, ReactNode } from "react";
import type { MalwareVerdict } from "../types.js";

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.15rem 0.5rem",
  borderRadius: "0.25rem",
  fontSize: "0.85rem",
  border: "1px solid currentColor",
  background: "transparent",
};

export function ImportStatusBadge({ status }: { status: string }) {
  return (
    <span style={badgeBase} role="status" aria-label={`Import status ${status}`}>
      <span aria-hidden="true">●</span>
      {status}
    </span>
  );
}

export function MalwareVerdictBadge({ verdict }: { verdict: MalwareVerdict | string }) {
  const tone =
    verdict === "CLEAN" || verdict === "OVERRIDE_APPROVED"
      ? "#0a7a3e"
      : verdict === "QUARANTINED" || verdict === "INFECTED" || verdict === "SUSPICIOUS"
        ? "#a11"
        : "#666";
  return (
    <span
      style={{ ...badgeBase, color: tone }}
      role="status"
      aria-label={`Malware verdict ${verdict}`}
    >
      <span aria-hidden="true">{verdict === "CLEAN" ? "✓" : "!"}</span>
      {verdict}
    </span>
  );
}

export function DuplicateConfidenceBadge({
  confidence,
  band,
}: {
  confidence: number;
  band?: string;
}) {
  const label = band ?? (confidence >= 0.85 ? "HIGH" : confidence >= 0.6 ? "MEDIUM" : "LOW");
  return (
    <span style={badgeBase} role="status" aria-label={`Duplicate confidence ${label}`}>
      {label} ({Math.round(confidence * 100)}%)
    </span>
  );
}

export function SensitiveValue({
  value,
  sensitive,
  privileged,
  neverReturnable,
}: {
  value: unknown;
  sensitive?: boolean;
  privileged?: boolean;
  neverReturnable?: boolean;
}) {
  const text = value == null ? "—" : String(value);
  return (
    <span
      data-sensitive={sensitive ? "true" : undefined}
      data-privileged={privileged ? "true" : undefined}
      data-never-returnable={neverReturnable ? "true" : undefined}
      title={
        neverReturnable
          ? "Never-returnable credential"
          : sensitive
            ? "Sensitive (masked)"
            : undefined
      }
    >
      {text}
      {sensitive ? (
        <span style={{ marginLeft: "0.35rem", fontSize: "0.75rem", color: "#666" }}>
          {neverReturnable ? "[SECRET]" : privileged ? "[PRIVILEGED]" : "[MASKED]"}
        </span>
      ) : null}
    </span>
  );
}

export function PrivilegedAccessBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      style={{ padding: "0.75rem", border: "1px solid #a11", marginBottom: "1rem" }}
    >
      Privileged sensitive access is active for this session. Credentials and secrets remain
      non-returnable. Do not copy values into tickets or chat.
    </div>
  );
}

const PRODUCTION_LIKE = new Set([
  "staging",
  "production",
  "govcloud-staging",
  "govcloud-production",
]);

/** Outcome B production restriction banner — not dismissible; admins cannot bypass. */
export function ProductionScannerRestrictionBanner({ appEnv }: { appEnv?: string | null }) {
  if (!appEnv || !PRODUCTION_LIKE.has(appEnv)) return null;
  return (
    <div
      role="alert"
      style={{
        padding: "0.75rem",
        border: "1px solid #8a5a00",
        background: "#fff8e6",
        marginBottom: "1rem",
      }}
    >
      <strong>Production import restriction.</strong> Untrusted file imports are blocked in this
      environment until a production-grade malware scanner is configured. The reference scanner is
      development/test only. Administrators cannot bypass this control.
    </div>
  );
}

export function ImportEmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" style={{ padding: "2rem", textAlign: "center", color: "#555" }}>
      <p style={{ fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  );
}

export function ImportProgressBar({ percent, label }: { percent: number; label?: string }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Import progress"}
      style={{
        height: "0.75rem",
        background: "#e8e8e8",
        borderRadius: "0.25rem",
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${safe}%`, height: "100%", background: "#246" }} />
    </div>
  );
}
