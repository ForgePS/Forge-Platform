"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { OpsModuleWorkspace } from "@/components/ops-module-workspace";
import { SeasonalWorkforceWorkspace } from "@/components/seasonal-workforce-workspace";
import { StatusBadge } from "@/components/status-badge";
import { LocalPhotoField } from "@/components/local-photo-field";
import { friendlyActionError, friendlyLoadError } from "@/lib/friendly-error";
import { isSeasonalLifecycleEnabled } from "@/lib/personnel-seasonal";

type Bootstrap = {
  industrialEnabled: boolean;
  flags?: Record<string, boolean>;
  modules: Array<{ code: string; awsEnabled: boolean }>;
};

type PersonnelView = "roster" | "seasonal";

type ProfileTab = "overview" | "training" | "certifications" | "activity";

/**
 * Personnel shell: roster + seasonal, with profile deep-dive when opened from roster detail.
 * Training / cert tabs load linked training records by employee name or id.
 */
export function PersonnelWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has("industrial.personnel.view") ||
    permissions.has("industrial.admin") ||
    permissions.has("industrial.access");
  const canManage =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has("industrial.personnel.manage") ||
    permissions.has("industrial.admin");

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [view, setView] = useState<PersonnelView>("roster");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>("overview");
  const [linkedTraining, setLinkedTraining] = useState<Array<Record<string, unknown>>>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const boot = await apiGet<Bootstrap>("/api/v1/industrial/bootstrap");
        if (!cancelled) setBootstrap(boot);
      } catch {
        if (!cancelled) setBootstrap({ industrialEnabled: false, flags: {}, modules: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profileId) {
      setProfile(null);
      setLinkedTraining([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setProfileError(null);
      try {
        const data = await apiGet<Record<string, unknown>>(
          `/api/v1/industrial/personnel/${profileId}`,
        );
        if (cancelled) return;
        setProfile(data);
        const name = String(data.displayName ?? "").trim();
        const emp = String(data.employeeNumber ?? "").trim();
        const training = await apiGet<{ items: Array<Record<string, unknown>> }>(
          "/api/v1/industrial/training",
          { query: { page: "1", pageSize: "50", q: name || emp || undefined } },
        );
        if (cancelled) return;
        const items = (training.items ?? []).filter((row) => {
          const assignee = String(row.assigneeName ?? "").toLowerCase();
          const pid = String(row.personnelId ?? "");
          return (
            pid === profileId ||
            (name && assignee.includes(name.toLowerCase())) ||
            (emp && String(row.employeeNumber ?? "") === emp)
          );
        });
        setLinkedTraining(items);
      } catch (e) {
        if (!cancelled) setProfileError(friendlyLoadError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const flagsKnown = bootstrap !== null;
  const seasonalOn = isSeasonalLifecycleEnabled(bootstrap?.flags);
  const showSwitcher = Boolean(canView && flagsKnown);

  async function saveProfilePhoto(next: {
    fileName: string;
    contentType: string;
    dataUrl: string;
  } | null) {
    if (!profileId || !canManage) return;
    setPhotoBusy(true);
    setProfileError(null);
    try {
      const updated = await apiSend<Record<string, unknown>>(
        `/api/v1/industrial/personnel/${profileId}/fields`,
        "POST",
        next
          ? {
              photoFileName: next.fileName,
              photoContentType: next.contentType,
              photoDataUrl: next.dataUrl,
            }
          : { photoFileName: null, photoContentType: null, photoDataUrl: null },
      );
      setProfile(updated);
    } catch (e) {
      setProfileError(friendlyActionError(e));
    } finally {
      setPhotoBusy(false);
    }
  }

  if (profileId && profile) {
    const name = String(profile.displayName ?? "Employee");
    const title = String(profile.jobTitle ?? profile.position ?? "");
    return (
      <div className="ind-personnel-profile">
        <PageHeader
          title={name}
          description={title || "Employee profile"}
          actions={
            <>
              <StatusBadge status={String(profile.status ?? "ACTIVE")} />
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setProfileId(null);
                  setProfile(null);
                  setProfileTab("overview");
                }}
              >
                Back to roster
              </button>
            </>
          }
        />

        {profileError ? (
          <div className="alert alert-danger" role="alert">
            {profileError}
          </div>
        ) : null}

        <div className="btn-group mb-4 flex-wrap" role="tablist" aria-label="Employee profile">
          {(
            [
              ["overview", "Overview"],
              ["training", "Training"],
              ["certifications", "Certifications"],
              ["activity", "Activity"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={profileTab === id}
              className={`btn btn-sm ${profileTab === id ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setProfileTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {profileTab === "overview" ? (
          <div className="row g-4">
            <div className="col-lg-4">
              <PageSection title="Photo">
                {typeof profile.photoDataUrl === "string" ? (
                  <img
                    src={String(profile.photoDataUrl)}
                    alt={name}
                    className="rounded border mb-3"
                    style={{ width: "100%", maxHeight: 220, objectFit: "cover" }}
                  />
                ) : (
                  <p className="text-muted small">No employee photo yet.</p>
                )}
                {canManage ? (
                  <LocalPhotoField
                    label="Upload photo"
                    valueName={
                      typeof profile.photoFileName === "string"
                        ? String(profile.photoFileName)
                        : null
                    }
                    valuePreviewUrl={
                      typeof profile.photoDataUrl === "string"
                        ? String(profile.photoDataUrl)
                        : null
                    }
                    disabled={photoBusy}
                    onChange={(next) => void saveProfilePhoto(next)}
                  />
                ) : null}
              </PageSection>
            </div>
            <div className="col-lg-8">
              <PageSection title="Contact & assignment">
                <dl className="row small mb-0">
                  {(
                    [
                      ["Employee number", profile.employeeNumber],
                      ["Email", profile.email],
                      ["Phone", profile.phone],
                      ["Department", profile.department],
                      ["Position", profile.jobTitle ?? profile.position],
                      ["Supervisor", profile.supervisorName],
                      ["Employment type", profile.employmentType],
                      ["Location", profile.location],
                      ["Hire / start date", profile.hireDate],
                    ] as Array<[string, unknown]>
                  ).map(([label, value]) => (
                    <div className="col-md-6 mb-2" key={label}>
                      <dt className="text-muted mb-0">{label}</dt>
                      <dd className="mb-0">
                        {value != null && String(value).length > 0 ? String(value) : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </PageSection>
            </div>
          </div>
        ) : null}

        {profileTab === "training" ? (
          <PageSection
            title="Training"
            description="Records linked to this employee."
            actions={
              <Link className="btn btn-sm btn-outline-primary" href="/modules/training">
                Open Training
              </Link>
            }
          >
            {linkedTraining.length === 0 ? (
              <EmptyState
                title="No training linked yet"
                description="Record training for this employee from the Training module."
                action={
                  <Link className="btn btn-sm btn-primary" href="/modules/training">
                    Record training
                  </Link>
                }
              />
            ) : (
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Status</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedTraining.map((row) => (
                      <tr key={String(row.id)}>
                        <td>{String(row.title ?? "—")}</td>
                        <td>
                          <StatusBadge
                            status={String(row.completionStatus ?? row.status ?? "")}
                          />
                        </td>
                        <td className="text-muted small">
                          {row.dueDate ? String(row.dueDate).slice(0, 10) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageSection>
        ) : null}

        {profileTab === "certifications" ? (
          <PageSection title="Certifications">
            <EmptyState
              title="No certifications yet"
              description="Certification tracking will appear here as records are linked. Use Training for course completion certificates today."
              action={
                <Link className="btn btn-sm btn-outline-primary" href="/modules/training">
                  Open Training
                </Link>
              }
            />
          </PageSection>
        ) : null}

        {profileTab === "activity" ? (
          <PageSection title="Activity">
            <ul className="list-unstyled small mb-0">
              <li className="mb-2">
                <span className="text-muted">Updated</span>{" "}
                {profile.updatedAt
                  ? new Date(String(profile.updatedAt)).toLocaleString()
                  : "—"}
              </li>
              <li className="mb-2">
                <span className="text-muted">Created</span>{" "}
                {profile.createdAt
                  ? new Date(String(profile.createdAt)).toLocaleString()
                  : "—"}
              </li>
              <li>
                <span className="text-muted">Training records</span> {linkedTraining.length}
              </li>
            </ul>
          </PageSection>
        ) : null}
      </div>
    );
  }

  return (
    <div className="ind-personnel">
      <PageHeader
        title={moduleName}
        description="Manage employees, assignments, training, certifications and documentation."
      />

      {showSwitcher ? (
        <div className="btn-group mb-4 flex-wrap" role="tablist" aria-label="Personnel views">
          <button
            type="button"
            role="tab"
            aria-selected={view === "roster"}
            className={`btn btn-sm ${view === "roster" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setView("roster")}
          >
            Roster
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "seasonal"}
            className={`btn btn-sm ${view === "seasonal" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setView("seasonal")}
            title={
              seasonalOn
                ? undefined
                : "Seasonal workforce is not available yet for this organization"
            }
          >
            Seasonal Workforce
          </button>
        </div>
      ) : null}

      {view === "seasonal" ? (
        <SeasonalWorkforceWorkspace onGoToRoster={() => setView("roster")} />
      ) : (
        <PersonnelRosterBridge onOpenProfile={(id) => setProfileId(id)} />
      )}
    </div>
  );
}

function PersonnelRosterBridge({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  return (
    <OpsModuleWorkspace
      module="personnel"
      moduleName="Personnel"
      hideHeader
      onRecordOpen={(row) => {
        if (row.id) onOpenProfile(String(row.id));
      }}
    />
  );
}
