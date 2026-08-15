'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.sendSms"
      apiPath={(gid) => `/api/guests/${gid}/communications?channel=SMS`}
      postPath={(gid) => `/api/guests/${gid}/communications`}
      addFields={[
        { name: 'body', label: 'SMS text', required: true, multiline: true },
      ]}
      buildBody={(v) => ({ channel: 'SMS', body: v.body.trim() })}
      searchKeys={['body', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.body)}
        </li>
      )}
    />
  );
}
