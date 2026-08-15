'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.sendEmail"
      apiPath={(gid) => `/api/guests/${gid}/communications?channel=EMAIL`}
      postPath={(gid) => `/api/guests/${gid}/communications`}
      addFields={[
        { name: 'subject', label: 'Subject', preset: 'longText' },
        { name: 'body', label: 'Email body', required: true, multiline: true },
      ]}
      buildBody={(v) => ({
        channel: 'EMAIL',
        subject: v.subject.trim(),
        body: v.body.trim(),
      })}
      searchKeys={['subject', 'body', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {r.subject ? <strong>{String(r.subject)}</strong> : null}
          <p className="mt-1">{String(r.body)}</p>
        </li>
      )}
    />
  );
}
