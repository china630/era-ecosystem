'use client';

import { GuestCrmExtensionPage } from '@/components/guest-crm/GuestCrmExtensionPage';

export default function Page() {
  return (
    <GuestCrmExtensionPage
      titleKey="crmPages.generalCrmTitle"
      field="generalCrmNotes"
      multiline
    />
  );
}
