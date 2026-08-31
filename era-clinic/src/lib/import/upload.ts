import type { ImportSummary } from '@/lib/import/types';

export function mergeImportSummaries(parts: ImportSummary[]): ImportSummary {
  if (parts.length === 0) {
    throw new Error('No import parts');
  }
  const first = parts[0];
  return {
    ...first,
    totalRows: parts.reduce((n, p) => n + p.totalRows, 0),
    created: parts.reduce((n, p) => n + p.created, 0),
    updated: parts.reduce((n, p) => n + p.updated, 0),
    skipped: parts.reduce((n, p) => n + p.skipped, 0),
    errors: parts.flatMap((p) => p.errors).slice(0, 50),
  };
}

export async function uploadImportFile(
  entity: string,
  file: File | File[],
  dryRun: boolean,
  onChunk?: (current: number, total: number, name: string) => void,
): Promise<ImportSummary> {
  const files = (Array.isArray(file) ? file : [file]).slice().sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const parts: ImportSummary[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onChunk?.(i + 1, files.length, f.name);
    const form = new FormData();
    form.append('file', f);
    const res = await fetch(`/api/import/${entity}?dryRun=${dryRun ? '1' : '0'}`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = typeof data.error === 'string' ? data.error : 'Import failed';
      throw new Error(`${f.name}: ${detail}`);
    }
    const summary = data as ImportSummary;
    parts.push({
      ...summary,
      errors: summary.errors.map((e) => ({
        ...e,
        message: files.length > 1 ? `${f.name}: ${e.message}` : e.message,
      })),
    });
  }
  return mergeImportSummaries(parts);
}

export async function runFilelessImportEntity(
  entity: string,
  dryRun: boolean,
): Promise<ImportSummary> {
  const res = await fetch(`/api/import/${entity}?dryRun=${dryRun ? '1' : '0'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Import failed');
  }
  return data as ImportSummary;
}
