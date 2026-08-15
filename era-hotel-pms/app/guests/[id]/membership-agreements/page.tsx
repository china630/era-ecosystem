'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.membershipTitle"
      apiPath={(gid) => `/api/guests/${gid}/time-shares`}
      addFields={[
        { name: 'contractNo', label: 'Contract number', required: true, preset: 'code' },
        { name: 'status', label: 'Status', defaultValue: 'ACTIVE', preset: 'shortText' },
      ]}
      buildBody={(v) => ({
        contractNo: v.contractNo.trim(),
        status: v.status.trim() || 'ACTIVE',
      })}
      searchKeys={['contractNo', 'unitCode', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <strong>{String(r.contractNo)}</strong>
          {r.unitCode ? <span className="text-[#7F8C8D]"> — {String(r.unitCode)}</span> : null}
          <span className="ml-2 text-[#2980B9]">{String(r.status)}</span>
        </li>
      )}
    />
  );
}
