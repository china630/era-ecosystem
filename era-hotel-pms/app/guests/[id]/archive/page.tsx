'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';

type Row = { id: string; title: string; docType: string; mimeType: string | null; sizeBytes: number | null; createdAt: string };

export default function GuestArchivePage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/guests/${id}/archive`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const title = file.name;
    const docType = window.prompt(t('crmPages.docTypePrompt'), 'ID') ?? 'OTHER';
    await fetch(`/api/guests/${id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        docType,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });
    e.target.value = '';
    await load();
  }

  return (
    <AppShell maxWidthClass="max-w-[900px]">
      <PageHeader title={t('crmPages.archiveTitle')} actions={<Link href="/guests" className="text-[13px] text-[#2980B9]">{t('crmPages.backToGuests')}</Link>} />
      <StatusMessage>{msg}</StatusMessage>
      <label className={`${PRIMARY_BUTTON_CLASS} mb-4 inline-block cursor-pointer`}>
        {t('crmPages.upload')}
        <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => void onUpload(e)} />
      </label>
      <ul className="space-y-2 text-[13px]">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-[#D5DADF] p-3">
            <strong>{r.title}</strong> — {r.docType}
            {r.sizeBytes != null ? <span className="text-[#7F8C8D]"> ({Math.round(r.sizeBytes / 1024)} KB)</span> : null}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
