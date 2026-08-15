'use client';

import { useTranslations } from 'next-intl';
import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function GuestTasksPage() {
  const t = useTranslations('guestCard');
  return (
    <GuestCrmPromptListPage
      titleKey="tasksPage.title"
      apiPath={(gid) => `/api/guests/${gid}/tasks`}
      addLabelKey="tasksPage.add"
      addFields={[
        { name: 'title', label: t('tasksPage.prompt'), required: true, preset: 'longText' },
      ]}
      buildBody={(v) => ({ title: v.title.trim() })}
      searchKeys={['title', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="flex justify-between rounded-lg border border-[#D5DADF] p-3">
          <span>{String(r.title)}</span>
          <span className="text-[#7F8C8D]">{String(r.status)}</span>
        </li>
      )}
    />
  );
}
