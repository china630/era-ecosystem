'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
  ModalFooter,
  ModalShell,
} from '@era/satellite-kit/ui';
import { useClinicAuth } from '@/hooks/useClinicAuth';
import type { ImportSummary } from '@/lib/import/types';
import { uploadImportFile } from '@/lib/import/upload';

export type { ImportSummary };

type Step = 'pick' | 'preview' | 'done';

export function ImportButton({
  entity,
  label,
  onComplete,
  className,
}: {
  entity: string;
  label?: string;
  onComplete?: () => void;
  className?: string;
}) {
  const { auth, loading } = useClinicAuth();
  const [open, setOpen] = useState(false);
  const allowed = Boolean(auth?.canViewClinicAdmin || auth?.isPlatformSuperAdmin);

  if (loading || !allowed) return null;

  return (
    <>
      <button
        type="button"
        className={className ?? SECONDARY_BUTTON_CLASS}
        onClick={() => setOpen(true)}
        title={label ?? 'Import from Excel'}
      >
        <Upload className="inline h-4 w-4 mr-1" />
        Import
      </button>
      <ImportModal
        open={open}
        entity={entity}
        title={label ?? 'Import from Excel'}
        onClose={() => setOpen(false)}
        onComplete={() => {
          onComplete?.();
          setOpen(false);
        }}
      />
    </>
  );
}

export function ImportModal({
  open,
  entity,
  title,
  onClose,
  onComplete,
}: {
  open: boolean;
  entity: string;
  title: string;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep('pick');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePreview() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await uploadImportFile(entity, file, true));
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await uploadImportFile(entity, file, false));
      setStep('done');
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const summary = step === 'done' ? result : preview;

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle="Nafta cutover .xlsx — idempotent upsert"
      onClose={handleClose}
      maxWidthClass="max-w-2xl"
      footer={
        step === 'pick' ? (
          <ModalFooter
            onCancel={handleClose}
            onSubmit={() => void handlePreview()}
            busy={busy}
            submitDisabled={!file}
            submitLabel="Preview"
          />
        ) : step === 'preview' ? (
          <ModalFooter
            onCancel={() => setStep('pick')}
            onSubmit={() => void handleConfirm()}
            busy={busy}
            submitLabel="Import"
          />
        ) : (
          <ModalFooter onCancel={handleClose} submitLabel="Close" onSubmit={handleClose} />
        )
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {step === 'pick' && (
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className={MODAL_INPUT_CLASS}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-sm text-gray-500">
            Upload an era-ready workbook (.xlsx). Preview validates rows before writing.
          </p>
        </div>
      )}

      {(step === 'preview' || step === 'done') && summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded border p-2">Rows: {summary.totalRows}</div>
            <div className="rounded border p-2 text-green-700">Created: {summary.created}</div>
            <div className="rounded border p-2 text-blue-700">Updated: {summary.updated}</div>
            <div className="rounded border p-2">Skipped: {summary.skipped}</div>
          </div>
          {summary.errors.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Errors ({summary.errors.length})</p>
              <div className="max-h-48 overflow-auto">
                <table className={DATA_TABLE_CLASS}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>Row</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.errors.slice(0, 20).map((e) => (
                      <tr key={`${e.row}-${e.message}`} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>{e.row}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {step === 'done' && (
            <p className="text-sm text-green-700">
              Import completed. Re-uploading the same file will update existing records.
            </p>
          )}
        </div>
      )}
    </ModalShell>
  );
}
