import type { ImportSummary } from '@/components/import/ImportModal';

const STORAGE_KEY = 'era-retail-import-wizard-v1';

export type StoredImportStepStatus = {
  completedAt: string;
  created: number;
  updated: number;
  skipped: number;
  errorCount: number;
  fileName?: string;
};

export type ImportWizardStorage = Record<string, StoredImportStepStatus>;

function readStorage(): ImportWizardStorage {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ImportWizardStorage;
  } catch {
    return {};
  }
}

function writeStorage(data: ImportWizardStorage): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadImportStepStatuses(): ImportWizardStorage {
  return readStorage();
}

export function saveImportStepStatus(
  entity: string,
  summary: ImportSummary,
  fileName?: string,
): StoredImportStepStatus {
  const entry: StoredImportStepStatus = {
    completedAt: new Date().toISOString(),
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    errorCount: summary.errors.length,
    fileName,
  };
  const next = { ...readStorage(), [entity]: entry };
  writeStorage(next);
  return entry;
}

export function clearImportStepStatus(entity: string): void {
  const current = readStorage();
  delete current[entity];
  writeStorage(current);
}

export function clearAllImportStepStatuses(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isStepCompleted(entity: string, storage: ImportWizardStorage): boolean {
  return Boolean(storage[entity]);
}
