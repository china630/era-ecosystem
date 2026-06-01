'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';

export default function GuestContactLogsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const { rows, msg } = useGuestCrmList(`/api/guests/${id}/contact-logs`);

  return (
    <AppShell maxWidthClass="max-w-[800px]">
      <PageHeader
        title={t('crm.contactLogs')}
        actions={<Link href="/guests" className="text-[13px] text-[#2980B9]">{t('crmPages.backToGuests')}</Link>}
      />
      <StatusMessage>{msg}</StatusMessage>
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className="space-y-2 text-[13px]">
          {rows.map((r) => (
            <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
              {String(r.channel)} — {String(r.contactDate).slice(0, 10)}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
