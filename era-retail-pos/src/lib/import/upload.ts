import type { ImportSummary } from '@/components/import/ImportModal';

export async function uploadImportFile(
  entity: string,
  file: File | File[],
  dryRun: boolean,
): Promise<ImportSummary> {
  const form = new FormData();
  const files = Array.isArray(file) ? file : [file];
  for (const f of files) form.append('file', f);
  const res = await fetch(`/api/import/${entity}?dryRun=${dryRun ? '1' : '0'}`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Import failed');
  }
  return data as ImportSummary;
}

export async function runFilelessImportEntity(
  entity: string,
  dryRun: boolean,
): Promise<ImportSummary> {
  const res = await fetch(`/api/import/${entity}?dryRun=${dryRun ? '1' : '0'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Import failed');
  }
  return data as ImportSummary;
}
