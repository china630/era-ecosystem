'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.allergensTitle"
      apiPath={(gid) => `/api/guests/${gid}/allergens`}
      onAdd={async (guestId) => {
        const allergen = window.prompt('Allergen');
        if (!allergen?.trim()) return;
        await fetch(`/api/guests/${guestId}/allergens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allergen: allergen.trim() }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <strong>{String(r.allergen)}</strong>
          {r.note ? <p className="mt-1">{String(r.note)}</p> : null}
        </li>
      )}
    />
  );
}
