'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.commentsTitle"
      apiPath={(gid) => `/api/guests/${gid}/comments`}
      onAdd={async (guestId) => {
        const comment = window.prompt('Comment');
        if (!comment?.trim()) return;
        await fetch(`/api/guests/${guestId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: comment.trim(), state: 'NEW' }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <span className="text-[11px] text-[#7F8C8D]">{String(r.state)}</span>
          <p className="mt-1">{String(r.comment)}</p>
        </li>
      )}
    />
  );
}
