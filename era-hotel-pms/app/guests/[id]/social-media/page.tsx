'use client';

import { GuestCrmExtensionPage } from '@/components/guest-crm/GuestCrmExtensionPage';

export default function Page() {
  return (
    <GuestCrmExtensionPage
      titleKey="crmPages.socialMediaTitle"
      field="socialMedia"
      placeholder="platform: handle"
      socialMode
    />
  );
}
