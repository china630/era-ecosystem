'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.surveysTitle"
      apiPath={(gid) => `/api/guests/${gid}/surveys`}
      onAdd={async (guestId) => {
        const surveyName = window.prompt('Survey name');
        if (!surveyName?.trim()) return;
        await fetch(`/api/guests/${guestId}/surveys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surveyName: surveyName.trim(),
            filledAt: new Date().toISOString().slice(0, 10),
          }),
        });
      }}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.surveyName)} — {String(r.filledAt).slice(0, 10)}
        </li>
      )}
    />
  );
}
