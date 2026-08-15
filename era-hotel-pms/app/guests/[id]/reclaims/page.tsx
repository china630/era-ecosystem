'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.reclaimsTitle"
      apiPath={(gid) => `/api/guests/${gid}/reclaims`}
      addFields={[
        { name: 'comment', label: 'Reclaim comment', required: true, multiline: true },
      ]}
      buildBody={(v) => ({ comment: v.comment.trim() })}
      searchKeys={['comment']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          {String(r.comment)}
        </li>
      )}
    />
  );
}
