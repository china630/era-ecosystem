'use client';

import { useTranslations } from 'next-intl';
import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function GuestTagsPage() {
  const t = useTranslations('guestCard');
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.tagsTitle"
      apiPath={(gid) => `/api/guests/${gid}/tags`}
      addLabelKey="crmPages.addTag"
      addFields={[
        { name: 'name', label: t('crmPages.tagPrompt'), required: true, preset: 'shortText' },
      ]}
      buildBody={(v) => ({ name: v.name.trim() })}
      searchKeys={['name']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-full bg-[#EBF5FB] px-3 py-1 text-[13px] text-[#2980B9]">
          {String(r.name)}
        </li>
      )}
    />
  );
}
