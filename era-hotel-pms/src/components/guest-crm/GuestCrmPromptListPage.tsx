'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';

type Props = {
  titleKey: string;
  apiPath: (guestId: string) => string;
  onAdd: (guestId: string) => Promise<unknown>;
  renderItem: (row: Record<string, unknown>) => React.ReactNode;
};

export function GuestCrmPromptListPage({ titleKey, apiPath, onAdd, renderItem }: Props) {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const { rows, msg, reload } = useGuestCrmList(apiPath(id));

  return (
    <AppShell maxWidthClass="max-w-[900px]">
      <PageHeader
        title={t(titleKey as 'crmPages.preferencesTitle')}
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
        onClick={() => void onAdd(id).then(() => reload())}
      >
        {t('crmPages.add')}
      </button>
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className="space-y-2 text-[13px]">{rows.map((r) => renderItem(r))}</ul>
      )}
    </AppShell>
  );
}
