'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.specialDatesTitle"
      apiPath={(gid) => `/api/guests/${gid}/special-dates`}
      onAdd={async (guestId) => {
        const dateType = window.prompt('Date type (Anniversary, Birthday…)');
        const eventDate = window.prompt('Date (YYYY-MM-DD)');
        if (!dateType?.trim() || !eventDate?.trim()) return;
        await fetch(`/api/guests/${guestId}/special-dates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateType: dateType.trim(), eventDate }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.dateType)} — {String(r.eventDate).slice(0, 10)}
        </li>
      )}
    />
  );
}
