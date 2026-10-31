import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import {
  loadPatientAssignmentLedger,
  type AssignmentKind,
} from "@/domain/reports/patient-assignment-ledger";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { composePrintPatientStrip } from "@/domain/print/print-patient-strip";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { enterPrintSession } from "@/domain/print/print-session";
import { todayBakuYmd } from "@/lib/baku-day";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{
    lang?: string;
    autoprint?: string;
    roomNumber?: string;
    kind?: string;
  }>;
};

export default async function PrintPatientAssignmentsPage({
  params,
  searchParams,
}: Props) {
  await enterPrintSession();
  const { episodeId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const kindRaw = (sp.kind ?? "all").trim();
  const kind =
    kindRaw === "procedure" || kindRaw === "lab" || kindRaw === "visit"
      ? (kindRaw as AssignmentKind)
      : "all";

  const data = await loadPatientAssignmentLedger({
    episodeId,
    roomNumber: sp.roomNumber?.trim() || null,
    kind,
  });
  if (!data?.episode.patientRefId) notFound();

  const patientRef = await prisma.patientRef.findUnique({
    where: { id: data.episode.patientRefId },
    select: {
      firstName: true,
      lastName: true,
      sex: true,
      birthDate: true,
      phone: true,
      nationality: true,
    },
  });
  if (!patientRef) notFound();

  const fullName =
    [patientRef.lastName, patientRef.firstName].filter(Boolean).join(" ").trim() ||
    data.episode.patientLabel;

  const branding = await getPrintBranding(lang);
  const patient = composePrintPatientStrip({
    fullName,
    sex: patientRef.sex,
    birthDate: patientRef.birthDate,
    phone: patientRef.phone,
    nationality: patientRef.nationality,
    date: todayBakuYmd(),
    roomNumber: data.episode.roomNumber,
    doctorName: null,
  });

  return (
    <PrintShell
      lang={lang}
      branding={branding}
      patient={patient}
      title={printLabel(lang, "patientAssignments")}
      autoPrint={sp.autoprint === "1"}
    >
      <p className="mb-2 text-[11px]">
        {printLabel(lang, "room")}: {data.episode.roomNumber || "—"}
        {data.episode.programCode ? ` · ${data.episode.programCode}` : ""}
      </p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="p-1 text-left">{printLabel(lang, "procedureName")}</th>
            <th className="p-1 text-left">{printLabel(lang, "assigned")}</th>
            <th className="p-1 text-left">{printLabel(lang, "completed")}</th>
            <th className="p-1 text-left">{printLabel(lang, "time")}</th>
            <th className="p-1 text-left">{printLabel(lang, "room")}</th>
            <th className="p-1 text-left">{printLabel(lang, "price")}</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr>
              <td className="p-1" colSpan={6}>
                {printLabel(lang, "episodeSummaryEmpty")}
              </td>
            </tr>
          ) : (
            data.rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-300 align-top">
                <td className="p-1">
                  <div>{row.name}</div>
                  <div className="text-neutral-600">{row.code}</div>
                </td>
                <td className="p-1">{row.assigned}</td>
                <td className="p-1">{row.completed}</td>
                <td className="p-1">{row.scheduledAtLabel || "—"}</td>
                <td className="p-1">{row.roomNumber || "—"}</td>
                <td className="p-1">
                  {row.amount > 0 ? row.amount.toFixed(2) : "—"}
                </td>
              </tr>
            ))
          )}
          <tr>
            <td className="p-1 font-semibold">{printLabel(lang, "total")}</td>
            <td className="p-1 font-semibold">{data.totals.assigned}</td>
            <td className="p-1 font-semibold">{data.totals.completed}</td>
            <td className="p-1" />
            <td className="p-1" />
            <td className="p-1 font-semibold">
              {data.totals.amount.toFixed(2)} AZN
            </td>
          </tr>
        </tbody>
      </table>
    </PrintShell>
  );
}
