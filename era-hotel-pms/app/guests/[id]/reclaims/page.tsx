'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.reclaimsTitle"
      apiPath={(gid) => `/api/guests/${gid}/reclaims`}
      onAdd={async (guestId) => {
        const comment = window.prompt('Reclaim comment');
        if (!comment?.trim()) return;
        await fetch(`/api/guests/${guestId}/reclaims`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: comment.trim() }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          {String(r.comment)}
        </li>
      )}
    />
  );
}
