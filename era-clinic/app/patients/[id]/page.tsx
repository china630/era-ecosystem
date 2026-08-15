"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@era/satellite-kit/ui";
import { PatientCardBody } from "@/components/patients/PatientCardBody";

export default function PatientCardPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const t = useTranslations("patientRegistry");

  return (
    <>
      <PageHeader title={t("openCard")} subtitle={params.id} />
      <PatientCardBody patientId={params.id} panel={panel} showBackLink />
    </>
  );
}
