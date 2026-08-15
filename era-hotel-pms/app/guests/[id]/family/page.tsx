'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.familyTitle"
      apiPath={(gid) => `/api/guests/${gid}/family`}
      addFields={[
        { name: 'relatedGuestId', label: 'Related guest UUID', required: true, preset: 'longText' },
        { name: 'relationship', label: 'Relationship', required: true, preset: 'shortText', placeholder: 'Spouse, Child…' },
      ]}
      buildBody={(v) => ({
        relatedGuestId: v.relatedGuestId.trim(),
        relationship: v.relationship.trim(),
      })}
      searchKeys={['relatedGuestId', 'relationship']}
      renderItem={(r) => {
        const rel = r.relatedGuest as { fullName?: string } | undefined;
        return (
          <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
            {rel?.fullName ?? String(r.relatedGuestId)} — {String(r.relationship)}
          </li>
        );
      }}
    />
  );
}
