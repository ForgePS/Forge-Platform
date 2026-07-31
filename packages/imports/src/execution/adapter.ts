export const FAILURE_CLASSES = [
  "RETRIABLE",
  "NON_RETRIABLE_ROW",
  "NON_RETRIABLE_JOB",
  "SECURITY_FAILURE",
] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];

export const ROLLBACK_CLASSIFICATIONS = [
  "FULLY_REVERSIBLE",
  "COMPENSATING_ACTION",
  "MANUAL_REVIEW_REQUIRED",
  "NOT_REVERSIBLE",
] as const;
export type RollbackClassification = (typeof ROLLBACK_CLASSIFICATIONS)[number];

export type NormalizedImportRecord = {
  rowId: string;
  sourceRowKey: string;
  mapped: Record<string, unknown>;
  operationKey?: string | null;
  sourceHash?: string | null;
};

export type AdapterExecutionContext = {
  tenantId: string;
  jobId: string;
  batchId: string;
  correlationId: string;
  productCode: string;
  moduleCode: string;
  recordType: string;
  mappingSnapshot: unknown[];
  workerId: string;
  attempt: number;
};

export type AdapterBatchContext = AdapterExecutionContext & {
  batchNumber: number;
};

export type ImportRecordResult = {
  outcome: "CREATED" | "UPDATED" | "UNCHANGED" | "SKIPPED" | "DUPLICATE" | "FAILED";
  destinationRecordId?: string;
  operationType?: string;
  rollbackClassification: RollbackClassification;
  beforeRef?: Record<string, unknown>;
  afterRef?: Record<string, unknown>;
  compensation?: Record<string, unknown>;
  failureClass?: FailureClass;
  errorCode?: string;
  errorMessage?: string;
};

export type CompensationResult = {
  compensated: boolean;
  details?: Record<string, unknown>;
};

export type ImportRollbackJournalEntry = {
  rowId: string;
  destinationRecordId?: string;
  operationType: string;
  rollbackClassification: RollbackClassification;
  beforeRef?: Record<string, unknown>;
  afterRef?: Record<string, unknown>;
  compensation?: Record<string, unknown>;
  adapterKey: string;
  adapterVersion: string;
  committedAt: string;
  correlationId: string;
};

export type AdapterRollbackContext = {
  tenantId: string;
  jobId: string;
  correlationId: string;
};

export interface ImportRecordAdapter {
  key: string;
  version: string;
  validateExecutionContext(context: AdapterExecutionContext): Promise<void>;
  prepareBatch(context: AdapterBatchContext): Promise<AdapterBatchContext>;
  executeRecord(
    record: NormalizedImportRecord,
    context: AdapterExecutionContext,
  ): Promise<ImportRecordResult>;
  compensateRecord?(
    journalEntry: ImportRollbackJournalEntry,
    context: AdapterRollbackContext,
  ): Promise<CompensationResult>;
  finalizeBatch?(context: AdapterBatchContext): Promise<void>;
  classifyRollback?(result: ImportRecordResult): RollbackClassification;
}

export function adapterRegistryKey(input: {
  productKey: string;
  moduleKey: string;
  recordType: string;
  adapterVersion?: string;
}): string {
  const version = input.adapterVersion ?? "1";
  return `${input.productKey}:${input.moduleKey}:${input.recordType}@${version}`;
}

export class ImportAdapterRegistry {
  private readonly adapters = new Map<string, ImportRecordAdapter>();

  register(adapter: ImportRecordAdapter): void {
    this.adapters.set(adapter.key, adapter);
  }

  resolve(key: string): ImportRecordAdapter {
    const adapter = this.adapters.get(key);
    if (!adapter) {
      const error = new Error(`Import adapter not found: ${key}`);
      (error as Error & { code: string; failureClass: FailureClass }).code = "IMPORT_ADAPTER_MISSING";
      (error as Error & { failureClass: FailureClass }).failureClass = "NON_RETRIABLE_JOB";
      throw error;
    }
    return adapter;
  }

  has(key: string): boolean {
    return this.adapters.has(key);
  }

  listKeys(): string[] {
    return [...this.adapters.keys()];
  }
}
