'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { bakuDateDisplay } from '@era/satellite-kit/time';

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
          defaultValue: hotelDateKey(),
        },
      ]}
      buildBody={(v) => ({
        surveyName: v.surveyName.trim(),
        filledAt: v.filledAt.trim(),
      })}
      searchKeys={['surveyName', 'filledAt']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.surveyName)} — {bakuDateDisplay(String(r.filledAt))}
        </li>
      )}
    />
  );
}
