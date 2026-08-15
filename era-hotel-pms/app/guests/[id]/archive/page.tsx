'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  ModalShell,
  ModalFooter,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type Row = {
  id: string;
  title: string;
  docType: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export default function GuestArchivePage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('ID');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/guests/${id}/archive`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.title} ${r.docType}`.toLowerCase().includes(q));
  }, [rows, debouncedQ]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDocType('ID');
    setPendingFile(file);
  }

  async function submitUpload() {
    if (!pendingFile) return;
    if (!docType.trim()) {
      showApiError({ error: tc('required') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/guests/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pendingFile.name,
          docType: docType.trim(),
          mimeType: pendingFile.type,
          sizeBytes: pendingFile.size,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      setPendingFile(null);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('crmPages.archiveTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
        actions={
          <label className={`${PRIMARY_BUTTON_CLASS} inline-block cursor-pointer`}>
            {t('crmPages.upload')}
            <input type="file" className="hidden" accept="image/*,.pdf" onChange={onPickFile} />
          </label>
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setQ('')}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={`${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]`}>
          {filtered.map((r) => (
            <li key={r.id} className="rounded-lg border border-[#D5DADF] p-3">
              <strong>{r.title}</strong> — {r.docType}
              {r.sizeBytes != null ? (
                <span className="text-[#7F8C8D]"> ({Math.round(r.sizeBytes / 1024)} KB)</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ModalShell
        open={!!pendingFile}
        title={t('crmPages.upload')}
        onClose={() => {
          if (!busy) setPendingFile(null);
        }}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={() => {
              if (!busy) setPendingFile(null);
            }}
            onSubmit={() => void submitUpload()}
            busy={busy}
            cancelLabel={tc('cancel')}
            submitLabel={tc('save')}
          />
        }
      >
        <div className="space-y-3 text-[13px]">
          <p className="text-[#7F8C8D]">{pendingFile?.name}</p>
          <Field
            label={t('crmPages.docTypePrompt')}
            preset="shortText"
            required
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          />
        </div>
      </ModalShell>
    </>
  );
}
