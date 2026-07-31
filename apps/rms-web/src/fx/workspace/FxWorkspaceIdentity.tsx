"use client";

/** Record identity eyebrow / meta line — existing values only. */
export function FxWorkspaceIdentity({
  recordType,
  recordId,
  owner,
  timestamps,
}: {
  recordType: string;
  recordId?: string;
  owner?: string | null;
  timestamps?: { createdAt?: string; updatedAt?: string };
}) {
  return (
    <div className="rms-fx-workspace__identity">
      <p className="rms-fx-workspace__eyebrow" id="fx-workspace-context-label">
        {recordType}
        {recordId ? ` · ${recordId}` : ""}
      </p>
      {owner ? <p className="rms-fx-workspace__meta">Owner: {owner}</p> : null}
      {timestamps?.updatedAt ? (
        <p className="rms-fx-workspace__meta">
          Updated {new Date(timestamps.updatedAt).toLocaleString()}
          {timestamps.createdAt
            ? ` · Created ${new Date(timestamps.createdAt).toLocaleString()}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
