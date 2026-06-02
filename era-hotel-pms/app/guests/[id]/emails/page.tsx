'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.sendEmail"
      apiPath={(gid) => `/api/guests/${gid}/communications?channel=EMAIL`}
      onAdd={async (guestId) => {
        const body = window.prompt('Email body');
        const subject = window.prompt('Subject') ?? '';
        if (!body?.trim()) return;
        await fetch(`/api/guests/${guestId}/communications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: 'EMAIL', subject, body: body.trim() }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {r.subject ? <strong>{String(r.subject)}</strong> : null}
          <p className="mt-1">{String(r.body)}</p>
        </li>
      )}
    />
  );
}
