'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.incidentsTitle"
      apiPath={(gid) => `/api/guests/${gid}/incidents`}
      addFields={[
        { name: 'location', label: 'Location', required: true, preset: 'longText' },
        { name: 'description', label: 'Description', required: true, multiline: true },
      ]}
      buildBody={(v) => ({
        location: v.location.trim(),
        description: v.description.trim(),
      })}
      searchKeys={['location', 'description']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <strong>{String(r.location)}</strong>
          <p className="mt-1">{String(r.description)}</p>
        </li>
      )}
    />
  );
}
