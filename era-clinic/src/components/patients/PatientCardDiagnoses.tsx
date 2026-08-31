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

type Props = {
  patientRefId: string;
  episodeId?: string | null;
  readOnly?: boolean;
};

export function PatientCardDiagnoses({
  patientRefId,
  episodeId,
  readOnly = false,
}: Props) {
  const t = useTranslations("patientCard");
  const tc = useTranslations("common");
  const [resolvedEpisodeId, setResolvedEpisodeId] = useState<string | null | undefined>(
    episodeId === undefined ? undefined : episodeId,
  );

  useEffect(() => {
    if (episodeId) {
      setResolvedEpisodeId(episodeId);
      return;
    }
    if (episodeId === null) {
      setResolvedEpisodeId(null);
      return;
    }
    let cancelled = false;
    const q = "";
    void fetch(`/api/patients/${patientRefId}/diagnoses${q}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) {
          if (!cancelled) setResolvedEpisodeId(null);
          return;
        }
        const row = raw.data ?? raw;
        setResolvedEpisodeId(typeof row.episodeId === "string" ? row.episodeId : null);
      })
      .catch(() => {
        if (!cancelled) setResolvedEpisodeId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [patientRefId, episodeId]);

  const apiBase = resolvedEpisodeId
    ? `/api/patients/${patientRefId}/diagnoses?episode=${encodeURIComponent(resolvedEpisodeId)}`
    : `/api/patients/${patientRefId}/diagnoses`;

  return (
    <section className={`${CARD_CONTAINER_CLASS} p-4`}>
      {resolvedEpisodeId ? (
        <DiagnosisPanel
          apiBase={apiBase}
          title={t("diagnosesTitle")}
          showRole={false}
          readOnly={readOnly}
        />
      ) : (
        <>
          <h3 className="font-semibold">{t("diagnosesTitle")}</h3>
          {resolvedEpisodeId === undefined ? (
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
