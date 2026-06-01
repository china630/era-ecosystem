'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.specialNotesTitle"
      apiPath={(gid) => `/api/guests/${gid}/special-notes`}
      onAdd={async (guestId) => {
        const text = window.prompt('Special note (min 5 chars)');
        if (!text || text.trim().length < 5) return;
        await fetch(`/api/guests/${guestId}/special-notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim() }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-rose-300 bg-rose-50/80 p-3 text-rose-900">
          {String(r.text)}
        </li>
      )}
    />
  );
}
