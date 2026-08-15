'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.specialDatesTitle"
      apiPath={(gid) => `/api/guests/${gid}/special-dates`}
      addFields={[
        { name: 'dateType', label: 'Date type', required: true, preset: 'shortText', placeholder: 'Anniversary, Birthday…' },
        { name: 'eventDate', label: 'Date', required: true, preset: 'date', placeholder: 'YYYY-MM-DD' },
      ]}
      buildBody={(v) => ({
        dateType: v.dateType.trim(),
        eventDate: v.eventDate.trim(),
      })}
      searchKeys={['dateType', 'eventDate']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.dateType)} — {String(r.eventDate).slice(0, 10)}
        </li>
      )}
    />
  );
}
