"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@forge/web-kit";
import { FxButton } from "@forge/fx-ui";
import { FeatureGate } from "@/components/feature-gate";
import { createIncident } from "@/lib/rms-api";
import { FxActionBar } from "@/fx/forms/FxActionBar";
import { FxDateField, FxTextarea } from "@/fx/forms/fields";
import { FxForm, FxFormSection } from "@/fx/forms/FxForm";
import { FxValidationSummary } from "@/fx/forms/FxValidationSummary";
import { ensureFormsRegistered } from "@/fx/forms/register-all";
import { useRmsFxIncidentModule } from "@/fx/modules/use-incident-module";
import "@/fx/forms/forms.css";
import styles from "../../page.module.css";

export default function NewIncidentPage() {
  const { me } = useAuth();
  const { newForm: newFormMode, loading: moduleFlagLoading } = useRmsFxIncidentModule();
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [dispatchDescription, setDispatchDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureFormsRegistered();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!me?.tenantId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createIncident(me.tenantId, {
        incidentDate,
        dispatchDescription: dispatchDescription.trim() || undefined,
        incidentSource: "MANUAL",
      });
      window.location.assign(`/incidents/${result.data.id}/?section=OVERVIEW`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setSubmitting(false);
    }
  }

  const useFx = !moduleFlagLoading && newFormMode === "fx";

  return (
    <FeatureGate flag="manualIntake" title="New incident">
      <section className={styles.page}>
        {useFx ? (
          <FxForm
            title="New manual incident"
            description="Create a draft incident and continue in the guided workspace. No CAD data is imported."
            onSubmit={onSubmit}
          >
            {error ? <FxValidationSummary errors={[error]} /> : null}
            <FxFormSection title="Intake">
              <FxDateField
                id="incidentDate"
                label="Incident date"
                required
                value={incidentDate}
                onChange={(event) => setIncidentDate(event.target.value)}
              />
              <FxTextarea
                id="dispatchDescription"
                label="Initial description (optional)"
                rows={4}
                value={dispatchDescription}
                onChange={(event) => setDispatchDescription(event.target.value)}
                placeholder="Brief dispatch or response summary"
              />
            </FxFormSection>
            <FxActionBar>
              <FxButton type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create manual incident"}
              </FxButton>
            </FxActionBar>
          </FxForm>
        ) : (
          <>
            <h1>New manual incident</h1>
            <p className={styles.lead}>
              Create a draft incident and continue in the guided workspace. No CAD data is imported.
            </p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <form className={styles.form} onSubmit={onSubmit}>
              <div className={styles.formRow}>
                <label htmlFor="incidentDate">Incident date</label>
                <input
                  id="incidentDate"
                  type="date"
                  required
                  value={incidentDate}
                  onChange={(event) => setIncidentDate(event.target.value)}
                />
              </div>
              <div className={styles.formRow}>
                <label htmlFor="dispatchDescription">Initial description (optional)</label>
                <textarea
                  id="dispatchDescription"
                  rows={4}
                  value={dispatchDescription}
                  onChange={(event) => setDispatchDescription(event.target.value)}
                  placeholder="Brief dispatch or response summary"
                />
              </div>
              <button className={styles.button} type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create manual incident"}
              </button>
            </form>
          </>
        )}
      </section>
    </FeatureGate>
  );
}
