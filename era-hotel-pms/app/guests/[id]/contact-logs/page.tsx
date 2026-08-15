'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader, EraListFilterBar,
  useDebouncedValue, Field, CARD_CONTAINER_CLASS } from '@era/satellite-kit/ui';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';

export default function GuestContactLogsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const { rows } = useGuestCrmList(`/api/guests/${id}/contact-logs`);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.channel} ${r.contactDate}`.toLowerCase().includes(q),
    );
  }, [rows, debouncedQ]);

  return (
    <>
      <PageHeader
        title={t('crm.contactLogs')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
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
            <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
              {String(r.channel)} — {String(r.contactDate).slice(0, 10)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
