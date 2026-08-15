'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.preferencesTitle"
      apiPath={(gid) => `/api/guests/${gid}/preferences`}
      addFields={[
        { name: 'preference', label: 'Preference', required: true, preset: 'longText' },
        { name: 'importance', label: 'Importance', defaultValue: 'HIGH', preset: 'shortText' },
        { name: 'note', label: 'Note', multiline: true },
      ]}
      buildBody={(v) => ({
        preference: v.preference.trim(),
        importance: v.importance.trim() || 'HIGH',
        note: v.note.trim() || undefined,
      })}
      searchKeys={['preference', 'importance', 'note']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <strong>{String(r.preference)}</strong>
          {r.importance ? <span className="text-[#7F8C8D]"> — {String(r.importance)}</span> : null}
          {r.note ? <p className="mt-1">{String(r.note)}</p> : null}
        </li>
      )}
    />
  );
}
