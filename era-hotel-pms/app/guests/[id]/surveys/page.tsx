'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.surveysTitle"
      apiPath={(gid) => `/api/guests/${gid}/surveys`}
      addFields={[
        { name: 'surveyName', label: 'Survey name', required: true, preset: 'longText' },
        {
          name: 'filledAt',
          label: 'Filled at',
          required: true,
          preset: 'date',
          defaultValue: new Date().toISOString().slice(0, 10),
        },
      ]}
      buildBody={(v) => ({
        surveyName: v.surveyName.trim(),
        filledAt: v.filledAt.trim(),
      })}
      searchKeys={['surveyName', 'filledAt']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.surveyName)} — {String(r.filledAt).slice(0, 10)}
        </li>
      )}
    />
  );
}
