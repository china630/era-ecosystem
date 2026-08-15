'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.whatsapp"
      apiPath={(gid) => `/api/guests/${gid}/communications?channel=WHATSAPP`}
      postPath={(gid) => `/api/guests/${gid}/communications`}
      addFields={[
        { name: 'body', label: 'Message', required: true, multiline: true },
      ]}
      buildBody={(v) => ({ channel: 'WHATSAPP', body: v.body.trim() })}
      searchKeys={['body', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <span className="text-[11px] text-[#7F8C8D]">{String(r.status)}</span>
          <p className="mt-1">{String(r.body)}</p>
        </li>
      )}
    />
  );
}
