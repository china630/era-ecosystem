'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.familyTitle"
      apiPath={(gid) => `/api/guests/${gid}/family`}
      onAdd={async (guestId) => {
        const relatedGuestId = window.prompt('Related guest UUID');
        const relationship = window.prompt('Relationship (Spouse, Child…)');
        if (!relatedGuestId?.trim() || !relationship?.trim()) return;
        await fetch(`/api/guests/${guestId}/family`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relatedGuestId: relatedGuestId.trim(),
            relationship: relationship.trim(),
          }),
        });
      }}
      renderItem={(r) => {
        const rel = r.relatedGuest as { fullName?: string } | undefined;
        return (
          <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
            {rel?.fullName ?? String(r.relatedGuestId)} — {String(r.relationship)}
          </li>
        );
      }}
    />
  );
}
