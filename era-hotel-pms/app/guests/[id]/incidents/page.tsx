'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.incidentsTitle"
      apiPath={(gid) => `/api/guests/${gid}/incidents`}
      onAdd={async (guestId) => {
        const location = window.prompt('Location');
        const description = window.prompt('Description');
        if (!location?.trim() || !description?.trim()) return;
        await fetch(`/api/guests/${guestId}/incidents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: location.trim(), description: description.trim() }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <strong>{String(r.location)}</strong>
          <p className="mt-1">{String(r.description)}</p>
        </li>
      )}
    />
  );
}
