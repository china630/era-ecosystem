"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

export default function TelehealthJoinPage() {
  const t = useTranslations("telehealth");
  const params = useSearchParams();
  const roomUrl = useMemo(() => params.get("room")?.trim() ?? "", [params]);

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-3 p-4 text-sm`}>
        {!roomUrl ? (
          <p className="text-slate-600">{t("missingRoom")}</p>
        ) : (
          <>
            <p>{t("ready")}</p>
            <a href={roomUrl} target="_blank" rel="noopener noreferrer" className={PRIMARY_BUTTON_CLASS}>
              {t("join")}
            </a>
            <p className="break-all text-xs text-slate-500">{roomUrl}</p>
          </>
        )}
      </div>
    </main>
  );
}