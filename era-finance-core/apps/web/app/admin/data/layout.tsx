"use client";

import { SuperAdminDataGate } from "../../../components/admin/data-gate";
import { SuperAdminDataHubNav } from "../../../components/admin/data-hub-nav";

export default function SuperAdminDataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SuperAdminDataGate>
      <div className="flex flex-col lg:flex-row gap-6 max-w-[1480px] mx-auto p-4">
        <SuperAdminDataHubNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </SuperAdminDataGate>
  );
}
