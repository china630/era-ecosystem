'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import type { ImportSummary } from '@/lib/import/types';
import { uploadImportFile, runFilelessImportEntity } from '@/lib/import/upload';
import {
  clearImportStepStatus,
  saveImportStepStatus,
  type StoredImportStepStatus,
} from '@/lib/import/step-status-storage';

type RowPhase = 'idle' | 'preview' | 'done';

type Props = {
  stepNumber: number;
  entity: string;
  label: string;
  templateHint: string;
  fileless?: boolean;
  strictOrder: boolean;
  isLastInPhase: boolean;
  storedStatus: StoredImportStepStatus | null;
  missingPriorLabels: string[];
  labels: {
    template: string;
    preview: string;
    import: string;
    back: string;
    reimport: string;
    rows: string;
    created: string;
    updated: string;
    skipped: string;
    errors: string;
    completed: string;
    orderWarning: string;
    pickFileHint: string;
    runBootstrap: string;
  };
  onStatusChange: (entity: string, status: StoredImportStepStatus | null) => void;
};

export function ImportStepRow({
  stepNumber,
  entity,
  label,
  templateHint,
  fileless = false,
  strictOrder,
  isLastInPhase,
  storedStatus,
  missingPriorLabels,
  labels,
  onStatusChange,
}: Props) {
  const [phase, setPhase] = useState<RowPhase>(() => (storedStatus ? 'done' : 'idle'));
  const [expanded, setExpanded] = useState(() => !storedStatus);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(storedStatus ? null : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = phase === 'done' ? result : preview;
  const done = phase === 'done' && Boolean(storedStatus || result);

  async function handleFilelessRun(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const s = await runFilelessImportEntity(entity, dryRun);
      if (dryRun) {
        setPreview(s);
        setPhase('preview');
      } else {
        setResult(s);
        setPhase('done');
        const stored = saveImportStepStatus(entity, s, '(bootstrap)');
        onStatusChange(entity, stored);
      }
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    if (fileless) {
      await handleFilelessRun(true);
      return;
    }
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const s = await uploadImportFile(entity, file, true);
      setPreview(s);
      setPhase('preview');
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (fileless) {
      await handleFilelessRun(false);
      return;
    }
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const s = await uploadImportFile(entity, file, false);
      setResult(s);
      setPhase('done');
      const stored = saveImportStepStatus(entity, s, file.name);
      onStatusChange(entity, stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleReimport() {
    setPhase('idle');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setExpanded(true);
    clearImportStepStatus(entity);
    onStatusChange(entity, null);
  }

  const statusLine = storedStatus
    ? labels.completed
        .replace('{created}', String(storedStatus.created))
        .replace('{updated}', String(storedStatus.updated))
        .replace('{errors}', String(storedStatus.errorCount))
    : null;

  return (
    <div className="relative">
      {!isLastInPhase && strictOrder ? (
        <div
          className="absolute left-[15px] top-[36px] bottom-[-12px] w-px bg-[#D5DADF]"
          aria-hidden
        />
      ) : null}

      <div
        className={[
          'rounded-lg border bg-white p-4',
          done ? 'border-green-200' : 'border-[#D5DADF]',
        ].join(' ')}
      >
        <button
          type="button"
          className="flex w-full items-start gap-3 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <span
            className={[
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              done ? 'bg-green-100 text-green-700' : 'bg-[#EBF5FB] text-[#2980B9]',
            ].join(' ')}
          >
            {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : stepNumber}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-medium text-[#34495E]">{label}</span>
              <ChevronDown
                className={[
                  'h-4 w-4 text-[#7F8C8D] transition',
                  expanded ? 'rotate-180' : '',
                ].join(' ')}
                aria-hidden
              />
            </span>
            <span className="mt-0.5 block text-[13px] text-[#7F8C8D]">
              {labels.template}: {templateHint}
            </span>
            {statusLine ? (
              <span className="mt-1 block text-[13px] text-green-700">{statusLine}</span>
            ) : null}
          </span>
        </button>

        {expanded ? (
          <div className="mt-4 space-y-3 pl-11">
            {missingPriorLabels.length > 0 ? (
              <p className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-[13px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {labels.orderWarning.replace('{steps}', missingPriorLabels.join(', '))}
              </p>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            {(phase === 'idle' || phase === 'preview') && !fileless && (
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className={MODAL_INPUT_CLASS}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setPreview(null);
                    setError(null);
                    if (phase === 'preview') setPhase('idle');
                  }}
                />
                <p className="text-[13px] text-[#7F8C8D]">{labels.pickFileHint}</p>
              </div>
            )}

            {fileless && phase === 'idle' ? (
              <p className="text-[13px] text-[#7F8C8D]">{templateHint}</p>
            ) : null}

            {(phase === 'preview' || phase === 'done') && summary ? (
              <ImportSummaryPanel summary={summary} labels={labels} />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {phase === 'idle' ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={(fileless ? false : !file) || busy}
                  onClick={() => void handlePreview()}
                >
                  {fileless ? labels.runBootstrap : labels.preview}
                </button>
              ) : null}
              {phase === 'preview' ? (
                <>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => {
                      setPhase('idle');
                      setPreview(null);
                    }}
                  >
                    {labels.back}
                  </button>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={(fileless ? false : !file) || busy}
                    onClick={() => void handleImport()}
                  >
                    {labels.import}
                  </button>
                </>
              ) : null}
              {phase === 'done' ? (
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleReimport}>
                  {labels.reimport}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ImportSummaryPanel({
  summary,
  labels,
}: {
  summary: ImportSummary;
  labels: Props['labels'];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded border p-2">
          {labels.rows}: {summary.totalRows}
        </div>
        <div className="rounded border p-2 text-green-700">
          {labels.created}: {summary.created}
        </div>
        <div className="rounded border p-2 text-blue-700">
          {labels.updated}: {summary.updated}
        </div>
        <div className="rounded border p-2">
          {labels.skipped}: {summary.skipped}
        </div>
      </div>
      {summary.errors.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">
            {labels.errors} ({summary.errors.length})
          </p>
          <div className="max-h-40 overflow-auto">
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>#</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{labels.errors}</th>
                </tr>
              </thead>
              <tbody>
                {summary.errors.slice(0, 15).map((e) => (
                  <tr key={`${e.row}-${e.message}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{e.row}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
