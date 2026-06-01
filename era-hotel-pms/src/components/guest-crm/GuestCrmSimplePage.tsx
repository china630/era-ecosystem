'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';

type Props = {
  titleKey: string;
  apiPath: string;
  addLabelKey: string;
  emptyKey?: string;
  onAdd: (guestId: string) => Promise<void>;
  renderRow: (row: Record<string, unknown>) => React.ReactNode;
};

export function GuestCrmSimplePage({
  titleKey,
  apiPath,
  addLabelKey,
  emptyKey = 'crmPages.empty',
  onAdd,
  renderRow,
}: Props) {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiPath.replace('{id}', id));
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [apiPath, id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell maxWidthClass="max-w-[900px]">
      <PageHeader
        title={t(titleKey as 'notesPage.title')}
        actions={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
      <StatusMessage>{msg}</StatusMessage>
      <button
        type="button"
        className={`${PRIMARY_BUTTON_CLASS} mb-4`}
        onClick={() => void onAdd(id).then(() => load())}
      >
        {t(addLabelKey as 'notesPage.add')}
      </button>
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t(emptyKey as 'crmPages.empty')}</p>
      ) : (
        <ul className="space-y-2 text-[13px]">{rows.map((r) => renderRow(r))}</ul>
      )}
    </AppShell>
  );
}
