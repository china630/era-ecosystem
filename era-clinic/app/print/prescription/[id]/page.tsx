"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PrintShell } from "@/components/print/PrintShell";

type PrescriptionLine = {
  qty: string | number;
  sku?: string | null;
  medication?: { innName?: string; tradeName?: string | null } | null;
  dose?: string | null;
  frequency?: string | null;
  instructions?: string | null;
};

type PrescriptionPrint = {
  id: string;
  issuedAt: string;
  patientRef?: { fullName?: string; refCode?: string };
  visit?: { practitioner?: { fullName?: string } };
  lines?: PrescriptionLine[];
};

export default function PrintPrescriptionPage() {
  const t = useTranslations("prescriptionPrint");
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<PrescriptionPrint | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/prescriptions/${id}`)
      .then(async (res) => {
        const body = (await res.json()) as PrescriptionPrint & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(body.error ?? t("loadFailed"));
          return;
        }
        if (!cancelled) setRow(body);
      })
      .catch(() => {
        if (!cancelled) setError(t("loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  return (
    <PrintShell title={t("title")}>
      {error ? <p>{error}</p> : null}
      {row ? (
        <div className="space-y-4 text-sm">
          <p>
            <strong>{row.patientRef?.fullName}</strong> ({row.patientRef?.refCode})
          </p>
          <p>
            {t("doctor")}: {row.visit?.practitioner?.fullName ?? "—"}
          </p>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="py-1">{t("colDrug")}</th>
                <th className="py-1">{t("colQty")}</th>
                <th className="py-1">{t("colSig")}</th>
              </tr>
            </thead>
            <tbody>
              {(row.lines ?? []).map((line, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-1">
                    {line.medication?.tradeName ?? line.medication?.innName ?? line.sku ?? "—"}
                  </td>
                  <td className="py-1">{String(line.qty)}</td>
                  <td className="py-1">
                    {[line.dose, line.frequency, line.instructions].filter(Boolean).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PrintShell>
  );
}