'use client';

import { GuestCrmExtensionPage } from '@/components/guest-crm/GuestCrmExtensionPage';

export default function Page() {
  return (
    <GuestCrmExtensionPage
      titleKey="crmPages.interestsTitle"
      field="interests"
      placeholder="e.g. hiking, chess"
    />
  );
}
