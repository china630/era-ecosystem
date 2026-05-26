"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Snapshot = {
  activeModules?: string[];
};

export default function RetailPlatformPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    void fetch("/api/platform/billing-snapshot")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSnapshot);
  }, []);

  const modules = snapshot?.activeModules ?? [];

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Platform add-ons"
        subtitle="Commerce bundle — portal, pay, delivery on receipt pay"
        actions={
          <Link href="/settings" className={SECONDARY_BUTTON_CLASS}>
            Settings
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-2 p-4 text-sm`}>
        <p>
          <strong>Entitlements:</strong>{" "}
          {modules.length ? modules.join(", ") : "loading…"}
        </p>
        <p className="text-[#7F8C8D]">
          On paid receipt, hooks call orchestrator for portal link, payment link, and
          optional shipment when `platform_*` modules are active.
        </p>
        <p className="text-[#7F8C8D]">
          UAT: pay a receipt with `platform_payments` enabled — API returns `payUrl` in
          response body.
        </p>
      </div>
    </div>
  );
}
