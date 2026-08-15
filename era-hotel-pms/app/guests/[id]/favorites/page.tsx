'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.favoritesTitle"
      apiPath={(gid) => `/api/guests/${gid}/favorites`}
      addFields={[
        { name: 'roomNumber', label: 'Room number', required: true, preset: 'code' },
        { name: 'roomType', label: 'Room type', preset: 'shortText' },
      ]}
      buildBody={(v) => ({
        roomNumber: v.roomNumber.trim(),
        roomType: v.roomType.trim() || undefined,
      })}
      searchKeys={['roomNumber', 'roomType']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          Room {String(r.roomNumber)}
          {r.roomType ? <span className="text-[#7F8C8D]"> ({String(r.roomType)})</span> : null}
        </li>
      )}
    />
  );
}
