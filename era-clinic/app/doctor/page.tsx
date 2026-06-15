"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

export default function DoctorPage() {
  const t = useTranslations("doctor");
  const [visits, setVisits] = useState<
    Array<{
      id: string;
      patientRef: { fullName: string };
      status: string;
      scheduledAt?: string;
      practitioner?: { fullName: string };
    }>
  >([]);

  useEffect(() => {
    void fetch("/api/appointments")
      .then((r) => r.json())
      .then((raw) => {
        const rows = (Array.isArray(raw) ? raw : (raw.data ?? [])) as Array<{
          visit?: { id: string; status: string } | null;
          patientRef: { fullName: string };
          status: string;
          scheduledAt: string;
          practitioner: { fullName: string };
        }>;
        setVisits(
          rows
            .filter(
              (a) =>
                a.visit &&
                (a.visit.status === "IN_PROGRESS" || a.status === "CHECKED_IN"),
            )
            .map((a) => ({
              id: a.visit!.id,
              status: a.visit!.status,
              patientRef: a.patientRef,
              scheduledAt: a.scheduledAt,
              practitioner: a.practitioner,
            })),
        );
      });
  }, []);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <ul className="space-y-2 text-sm">
          {visits.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded border p-2">
              <span>
                {v.patientRef.fullName} — {v.status}
                {v.scheduledAt ? (
                  <span className="block text-xs text-slate-500">
                    {new Date(v.scheduledAt).toLocaleString()}
                    {v.practitioner ? ` · ${v.practitioner.fullName}` : ""}
                  </span>
                ) : null}
              </span>
              <Link href={`/visits/${v.id}`} className={PRIMARY_BUTTON_CLASS}>
                {t("openVisit")}
              </Link>
            </li>
          ))}
          {visits.length === 0 && <li className="text-slate-500">{t("empty")}</li>}
        </ul>
      </div>
    </>
  );
}
