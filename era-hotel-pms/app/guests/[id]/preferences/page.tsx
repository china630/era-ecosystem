'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.preferencesTitle"
      apiPath={(gid) => `/api/guests/${gid}/preferences`}
      onAdd={async (guestId) => {
        const preference = window.prompt('Preference');
        if (!preference?.trim()) return;
        await fetch(`/api/guests/${guestId}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preference: preference.trim(), importance: 'HIGH' }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <strong>{String(r.preference)}</strong>
          {r.importance ? <span className="text-[#7F8C8D]"> — {String(r.importance)}</span> : null}
          {r.note ? <p className="mt-1">{String(r.note)}</p> : null}
        </li>
      )}
    />
  );
}
