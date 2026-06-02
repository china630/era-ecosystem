'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';

export default function GuestTagsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Array<{ id: string; name: string }>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/guests/${id}/tags`);
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

  async function addTag() {
    const name = window.prompt(t('crmPages.tagPrompt'));
    if (!name?.trim()) return;
    await fetch(`/api/guests/${id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    await load();
  }

  return (
    <AppShell maxWidthClass="max-w-[800px]">
      <PageHeader title={t('crmPages.tagsTitle')} actions={<Link href="/guests" className="text-[13px] text-[#2980B9]">{t('crmPages.backToGuests')}</Link>} />
      <StatusMessage>{msg}</StatusMessage>
      <button type="button" className={`${PRIMARY_BUTTON_CLASS} mb-4`} onClick={() => void addTag()}>
        {t('crmPages.addTag')}
      </button>
      <ul className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-full bg-[#EBF5FB] px-3 py-1 text-[13px] text-[#2980B9]">
            {r.name}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
