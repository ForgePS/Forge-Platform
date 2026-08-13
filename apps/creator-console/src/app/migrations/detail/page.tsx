"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ComingLater,
  ConfirmationDialog,
  ErrorState,
  FixtureBanner,
  ForgeBreadcrumbs,
  ForgeMetricCard,
  ForgeMetricGrid,
  ForgePageBody,
  ForgePageHeader,
  ForgePagePanel,
  ForgeStepper,
  FormField,
  LoadingIndicator,
  StatusBadge,
  useToast,
} from "@forge/ui";
import { useAuth } from "@/hooks/use-auth";
import { getMigrationStatusService } from "@/lib/migrations/mock-migration.service";
import type { MigrationDetail, MigrationUiStatus } from "@/lib/migrations/migration.types";

const STAGES = [
  { id: "discover", label: "Discover" },
  { id: "export", label: "Export" },
  { id: "transform", label: "Transform" },
  { id: "validate", label: "Validate" },
  { id: "load", label: "Load" },
  { id: "reconcile", label: "Reconcile" },
  { id: "verify", label: "Verify" },
  { id: "dry-run", label: "Dry run" },
  { id: "gate", label: "Gate check" },
  { id: "cutover", label: "Cutover" },
  { id: "complete", label: "Complete" },
];

function stageIndex(status: MigrationUiStatus): number {
  switch (status) {
    case "NOT_STARTED":
      return 0;
    case "PREPARING":
      return 1;
    case "READY":
      return 2;
    case "IMPORTING":
      return 4;
    case "VALIDATION_REQUIRED":
      return 5;
    case "COMPLETE":
      return 10;
    case "FAILED":
      return 5;
    default:
      return 0;
  }
}

function normalizeConfirm(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function MigrationDetailInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { hasPermission, me } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState<MigrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [cutoverStep, setCutoverStep] = useState(0);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [checklist, setChecklist] = useState({
    validation: false,
    reconciliation: false,
    permissionAck: false,
  });

  const canCutover =
    Boolean(me?.isPlatformAdmin) || hasPermission("platform.tenant.read");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!id) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      const next = await getMigrationStatusService().getMigration(id);
      if (cancelled) return;
      if (!next) setMissing(true);
      setDetail(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const activeIndex = useMemo(() => (detail ? stageIndex(detail.status) : 0), [detail]);
  const expectedConfirm = useMemo(
    () => (detail ? normalizeConfirm(detail.tenantDisplayName) : ""),
    [detail],
  );

  if (loading) return <LoadingIndicator label="Loading migration…" />;
  if (missing || !detail) {
    return (
      <ErrorState
        title="Migration unavailable"
        description="No migration record found for this id."
      />
    );
  }

  const confirmMatches = normalizeConfirm(confirmPhrase) === expectedConfirm;
  const gateReady =
    checklist.validation &&
    checklist.reconciliation &&
    checklist.permissionAck &&
    confirmMatches &&
    canCutover;

  return (
    <>
      <ForgePageHeader
        breadcrumbs={
          <ForgeBreadcrumbs
            items={[
              { label: "Migration Center", href: "/migrations/" },
              { label: detail.tenantDisplayName },
            ]}
            renderLink={({ href, children }) => <Link href={href!}>{children}</Link>}
          />
        }
        title={detail.tenantDisplayName}
        subtitle={`${detail.migrationType} · ${detail.source} → ${detail.destination}`}
        actions={
          <StatusBadge tone={detail.status === "FAILED" ? "danger" : "info"}>{detail.status}</StatusBadge>
        }
      />

      <ForgePageBody>
        {detail.dataSource === "MOCK" ? (
          <FixtureBanner>
            Fixture migration detail — adapter boundary only; no migration engine calls.
          </FixtureBanner>
        ) : null}

        <ForgeStepper steps={STAGES} activeIndex={activeIndex} />

        <ForgeMetricGrid>
          <ForgeMetricCard
            label="Progress"
            value={detail.progressPercent == null ? null : `${detail.progressPercent}%`}
          />
          <ForgeMetricCard label="Issues" value={detail.issueCount} />
          <ForgeMetricCard label="Users migrated" value={detail.users.migrated} />
          <ForgeMetricCard label="Users pending" value={detail.users.pending} />
        </ForgeMetricGrid>

        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
          }}
        >
          <Card title="Reconciliation">
            <table>
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Status</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {detail.collections.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>
                      <StatusBadge>{c.status}</StatusBadge>
                    </td>
                    <td>{c.recordCount ?? "Not available"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Actionable errors">
            {detail.exceptions.length === 0 ? <p>None</p> : null}
            <ul>
              {detail.exceptions.map((ex) => (
                <li key={ex.id}>
                  [{ex.severity}] {ex.message}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Documents / files">
            <ul>
              {detail.documents.map((d) => (
                <li key={d.name}>
                  {d.name}: <StatusBadge>{d.status}</StatusBadge>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="DataSync">
            <ComingLater>DataSync panel — Coming later (no API wired)</ComingLater>
          </Card>
        </div>

        <ForgePagePanel>
          <Card title="Final Cutover Approval">
            <Alert tone="danger">
              This action is intentionally protected. Customer traffic and DNS are not changed from this
              screen unless an authorized cutover workflow exists.
            </Alert>

            <h3 style={{ margin: "1.25rem 0 0.75rem", fontSize: "1rem" }}>Pre-cutover requirements</h3>
            <Checkbox
              id="cutover-validation"
              label="Validation complete and reviewed"
              checked={checklist.validation}
              onChange={(e) => setChecklist((c) => ({ ...c, validation: e.target.checked }))}
            />
            <Checkbox
              id="cutover-reconciliation"
              label="Reconciliation accepted"
              checked={checklist.reconciliation}
              onChange={(e) => setChecklist((c) => ({ ...c, reconciliation: e.target.checked }))}
            />
            <Checkbox
              id="cutover-dns-ack"
              label="I acknowledge DNS/customer cutover is handled separately"
              description="This console does not execute DNS or live customer cutover."
              checked={checklist.permissionAck}
              onChange={(e) => setChecklist((c) => ({ ...c, permissionAck: e.target.checked }))}
            />

            <h3 style={{ margin: "1.25rem 0 0.5rem", fontSize: "1rem" }}>Typed confirmation</h3>
            <FormField
              label="Type the customer name exactly to enable approval"
              htmlFor="cutover-confirm"
              hint={`Type: ${detail.tenantDisplayName}`}
              required
            >
              <input
                id="cutover-confirm"
                className="forge-input"
                autoComplete="off"
                spellCheck={false}
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                aria-describedby="cutover-confirm-hint"
                placeholder={detail.tenantDisplayName}
              />
            </FormField>
            <p id="cutover-confirm-hint" className="forge-form-field__hint">
              Required phrase: <strong>{detail.tenantDisplayName}</strong>
            </p>

            {!canCutover ? (
              <Alert tone="info">You do not have permission to request cutover confirmation.</Alert>
            ) : null}

            <div style={{ marginTop: "1.25rem" }}>
              <Button
                variant="danger"
                disabled={!gateReady}
                onClick={() => setCutoverStep(1)}
              >
                Approve Final Migration
              </Button>
            </div>
          </Card>
        </ForgePagePanel>

        <ConfirmationDialog
          open={cutoverStep === 1}
          title="Cutover step 1 of 2"
          description="Confirm you reviewed validation and reconciliation. This still will not execute DNS or customer cutover."
          confirmLabel="Continue"
          danger
          onCancel={() => setCutoverStep(0)}
          onConfirm={() => setCutoverStep(2)}
        />
        <ConfirmationDialog
          open={cutoverStep === 2}
          title="Cutover step 2 of 2"
          description="No cutover API is connected. Confirming only records that cutover was requested in the UI and will not change production traffic."
          confirmLabel="Acknowledge (no cutover executed)"
          danger
          onCancel={() => setCutoverStep(0)}
          onConfirm={() => {
            setCutoverStep(0);
            toast.push("Cutover not executed — no live cutover API connected", "warning");
          }}
        />

        <p>
          <Link href="/migrations/">Back to Migration Center</Link>
        </p>
      </ForgePageBody>
    </>
  );
}

export default function MigrationDetailPage() {
  return (
    <Suspense fallback={<LoadingIndicator label="Loading migration…" />}>
      <MigrationDetailInner />
    </Suspense>
  );
}
