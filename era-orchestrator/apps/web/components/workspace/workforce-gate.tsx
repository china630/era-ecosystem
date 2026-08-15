"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { enableWorkforceModule } from "../../lib/workforce-fetch";

/**
 * Friendly "Workforce not enabled" gate shown when a workforce page receives
 * a PLATFORM_WORKFORCE_REQUIRED (403). Lets the owner enable the module inline.
 */
export function WorkforceGate({ onEnabled }: { onEnabled: () => void | Promise<void> }) {
  const t = useTranslations("workforceGate");
  const [enabling, setEnabling] = useState(false);

  async function enable() {
    setEnabling(true);
    const ok = await enableWorkforceModule();
    setEnabling(false);
    if (ok) await onEnabled();
  }

  return (
    <div className={`${CARD_CONTAINER_CLASS} mx-auto mt-6 max-w-lg p-8 text-center`}>
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF5FB]">
        <ShieldCheck className="h-6 w-6 text-[#2980B9]" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#7F8C8D]">{t("hint")}</p>
      <button
        type="button"
        className={`${PRIMARY_BUTTON_CLASS} mt-6`}
        disabled={enabling}
        onClick={() => void enable()}
      >
        {enabling ? t("enabling") : t("enable")}
      </button>
      <p className="mt-4 text-sm">
        <Link href="/workspace" className="text-[#2980B9] hover:underline">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}
