'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.commentsTitle"
      apiPath={(gid) => `/api/guests/${gid}/comments`}
      addFields={[
        { name: 'comment', label: 'Comment', required: true, multiline: true },
      ]}
      buildBody={(v) => ({ comment: v.comment.trim(), state: 'NEW' })}
      searchKeys={['comment', 'state']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <span className="text-[11px] text-[#7F8C8D]">{String(r.state)}</span>
          <p className="mt-1">{String(r.comment)}</p>
        </li>
      )}
    />
  );
}
