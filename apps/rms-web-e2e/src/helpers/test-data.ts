/** Synthetic markers for E2E-created records. Never use real PII. */

export function e2eRunId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function syntheticDispatchDescription(runId = e2eRunId()): string {
  return `[E2E synthetic ${runId}] Manual incident acceptance test — no real CAD data.`;
}

export function syntheticNarrative(runId = e2eRunId()): string {
  return `Synthetic narrative for ${runId}. Test-only content for Forge RMS Phase 2 acceptance.`;
}

export function syntheticReturnReason(runId = e2eRunId()): string {
  return `[E2E ${runId}] Return for correction — synthetic review feedback.`;
}

export function syntheticSubmitNote(runId = e2eRunId()): string {
  return `[E2E ${runId}] Ready for officer review — synthetic submission note.`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
