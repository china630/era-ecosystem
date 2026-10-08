'use client';

import { useTranslations } from 'next-intl';
import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  const t = useTranslations('guestCard');
  return (
    <GuestCrmPromptListPage
      titleKey="crm.smsJournal"
      apiPath={(gid) => `/api/guests/${gid}/communications?channel=SMS`}
      postPath={(gid) => `/api/guests/${gid}/communications`}
      addFields={[
        { name: 'body', label: t('crmFields.message'), required: true, multiline: true },
      ]}
      buildBody={(v) => ({ channel: 'SMS', body: v.body.trim() })}
      searchKeys={['body', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.body)}
        </li>
      )}
    />
  );
}
