'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.membershipTitle"
      apiPath={(gid) => `/api/guests/${gid}/time-shares`}
      onAdd={async (guestId) => {
        const contractNo = window.prompt('Contract number');
        if (!contractNo?.trim()) return;
        await fetch(`/api/guests/${guestId}/time-shares`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractNo: contractNo.trim(), status: 'ACTIVE' }),
        });
      }}
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
