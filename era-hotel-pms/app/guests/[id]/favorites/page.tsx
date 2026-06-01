'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.favoritesTitle"
      apiPath={(gid) => `/api/guests/${gid}/favorites`}
      onAdd={async (guestId) => {
        const roomNumber = window.prompt('Room number');
        if (!roomNumber?.trim()) return;
        await fetch(`/api/guests/${guestId}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomNumber: roomNumber.trim() }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          Room {String(r.roomNumber)}
          {r.roomType ? <span className="text-[#7F8C8D]"> ({String(r.roomType)})</span> : null}
        </li>
      )}
    />
  );
}
