"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  LINK_ACCENT_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { DiagnosisPanel } from "@/components/DiagnosisPanel";

export function PatientCardDiagnoses({ patientRefId }: { patientRefId: string }) {
  const t = useTranslations("patientCard");
  const tc = useTranslations("common");
  const [episodeId, setEpisodeId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/patients/${patientRefId}/diagnoses`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) {
          if (!cancelled) setEpisodeId(null);
          return;
        }
        const row = raw.data ?? raw;
        setEpisodeId(typeof row.episodeId === "string" ? row.episodeId : null);
      })
      .catch(() => {
        if (!cancelled) setEpisodeId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [patientRefId]);

  return (
    <section className={`${CARD_CONTAINER_CLASS} p-4`}>
      {episodeId ? (
        <DiagnosisPanel
          apiBase={`/api/patients/${patientRefId}/diagnoses`}
          title={t("diagnosesTitle")}
          showRole={false}
        />
      ) : (
        <>
          <h3 className="font-semibold">{t("diagnosesTitle")}</h3>
          {episodeId === undefined ? (
            <p className={`mt-2 text-sm ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
          ) : (
            <p className={`mt-2 text-sm ${TEXT_MUTED_CLASS}`}>
              {t("diagnosesNoEpisode")}{" "}
              <Link href="/sanatorium" className={LINK_ACCENT_CLASS}>
                {t("diagnosesOpenSanatorium")}
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
