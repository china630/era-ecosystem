'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.specialNotesTitle"
      apiPath={(gid) => `/api/guests/${gid}/special-notes`}
      addFields={[
        { name: 'text', label: 'Special note', required: true, multiline: true, placeholder: 'Min 5 characters' },
      ]}
      buildBody={(v) => ({ text: v.text.trim() })}
      searchKeys={['text']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-rose-300 bg-rose-50/80 p-3 text-rose-900">
          {String(r.text)}
        </li>
      )}
    />
  );
}
