'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.allergensTitle"
      apiPath={(gid) => `/api/guests/${gid}/allergens`}
      addFields={[
        { name: 'allergen', label: 'Allergen', required: true, preset: 'longText' },
        { name: 'note', label: 'Note', multiline: true },
      ]}
      buildBody={(v) => ({
        allergen: v.allergen.trim(),
        note: v.note.trim() || undefined,
      })}
      searchKeys={['allergen', 'note']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <strong>{String(r.allergen)}</strong>
          {r.note ? <p className="mt-1">{String(r.note)}</p> : null}
        </li>
      )}
    />
  );
}
