'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.whatsapp"
      apiPath={(gid) => `/api/guests/${gid}/communications?channel=WHATSAPP`}
      onAdd={async (guestId) => {
        const body = window.prompt('Message');
        if (!body?.trim()) return;
        await fetch(`/api/guests/${guestId}/communications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: 'WHATSAPP', body: body.trim() }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <span className="text-[11px] text-[#7F8C8D]">{String(r.status)}</span>
          <p className="mt-1">{String(r.body)}</p>
        </li>
      )}
    />
  );
}
