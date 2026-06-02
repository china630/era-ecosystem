'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.sendSms"
      apiPath={(gid) => `/api/guests/${gid}/communications?channel=SMS`}
      onAdd={async (guestId) => {
        const body = window.prompt('SMS text');
        if (!body?.trim()) return;
        await fetch(`/api/guests/${guestId}/communications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: 'SMS', body: body.trim() }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.body)}
        </li>
      )}
    />
  );
}
