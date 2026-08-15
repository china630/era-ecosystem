'use client';

import { useTranslations } from 'next-intl';
import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function GuestNotesPage() {
  const t = useTranslations('guestCard');
  return (
    <GuestCrmPromptListPage
      titleKey="notesPage.title"
      apiPath={(gid) => `/api/guests/${gid}/notes`}
      addLabelKey="notesPage.add"
      addFields={[
        { name: 'text', label: t('notesPage.prompt'), required: true, multiline: true },
      ]}
      buildBody={(v) => ({ text: v.text.trim() })}
      searchKeys={['text', 'noteType']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <span className="text-[11px] text-[#7F8C8D]">{String(r.noteType)}</span>
          <p className="mt-1 whitespace-pre-wrap">{String(r.text)}</p>
        </li>
      )}
    />
  );
}
