"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CARD_CONTAINER_CLASS, GHOST_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";

export default function SuperAdminMdmPage() {
  const [health, setHealth] = useState<unknown>(null);

  useEffect(() => {
    void (async () => {
      const res = await cpAdminFetch("mdm/health");
      if (res.ok) setHealth(await res.json());
    })();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold">MDM</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">
        Global legal entities — <Link href="/super-admin/mdm/companies" className="text-[#2980B9]">browse companies</Link>
      </p>
      <Link href="/super-admin/mdm/companies" className={`${GHOST_BUTTON_CLASS} mt-4 inline-flex`}>
        Open company list
      </Link>
      <pre className={`${CARD_CONTAINER_CLASS} mt-4 overflow-auto p-4 text-xs`}>
        {JSON.stringify(health, null, 2)}
      </pre>
    </div>
  );
}
