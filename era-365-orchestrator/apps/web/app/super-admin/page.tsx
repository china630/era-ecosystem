"use client";

import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import { ShellHeader } from "../../components/shell-header";

export default function SuperAdminHubPage() {
  return (
    <>
      <ShellHeader />
      <h1 className="text-xl font-semibold">Super admin</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">
        Platform operations — billing, MDM, org security (API on control plane).
      </p>
      <ul className={`${CARD_CONTAINER_CLASS} mt-6 list-disc space-y-2 p-6 pl-10 text-sm`}>
        <li>Billing config and pricing — /super-admin/billing</li>
        <li>MDM registry — /super-admin/mdm/companies</li>
        <li>Early access funnel — /super-admin/early-access</li>
        <li>Org security & disputes — /super-admin/security</li>
      </ul>
    </>
  );
}
