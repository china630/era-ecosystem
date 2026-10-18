import { Fragment } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { loadExtraTicketPrint } from "@/domain/procedure/extra-ticket.service";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { bakuDateTimeDisplay } from "@/lib/baku-day";
import { composePrintPatientStrip, loadPrintEpisodeStay } from "@/domain/print/print-patient-strip";
import {
  loadCatalogDisplayNameMap,
  resolveOrderDisplayName,
} from "@/domain/catalog/catalog-display-name.service";

type Props = {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{
    organizationId?: string;
    lang?: string;
    autoprint?: string;
    sheets?: string;
    copy?: string;
  }>;
};

const COPIES = ["copyReception", "copyNurse", "copyGuest"] as const;

export default async function PrintExtraTicketPage({ params, searchParams }: Props) {
  const { ticketId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const organizationId = sp.organizationId?.trim();
  if (!organizationId) notFound();
  const sessionOrganizationId = (await headers()).get("x-era-organization-id")?.trim();
  if (sessionOrganizationId !== organizationId) notFound();
  const orders = await loadExtraTicketPrint(ticketId, organizationId);
  if (!orders.length) notFound();
  const first = orders[0]!;
  const branding = await getPrintBranding(lang);
  const sheetCount = sp.sheets === "1" ? 1 : COPIES.length;
  const copyIdx = Math.min(
    Math.max(0, Number(sp.copy ?? "1") - 1),
    COPIES.length - 1,
  );
  const copies: Array<(typeof COPIES)[number]> =
    sheetCount === 1 ? [COPIES[copyIdx]!] : [...COPIES];
  const catalogNames = await loadCatalogDisplayNameMap(
    orders.map((row) => row.procedureCode),
    lang,
  );
  const roomNumber =
    orders.map((row) => row.clinicalEpisode?.roomNumber?.trim()).find(Boolean) ?? null;
  const issuedAt = first.extraTicketIssuedAt ?? first.createdAt ?? first.scheduledAt;
  const total = orders.reduce((sum, row) => sum + Number(row.amountNet), 0);
  const stay = await loadPrintEpisodeStay({
    episodeId: first.clinicalEpisodeId,
    patientRefId: first.patientRefId,
  });
  const patient = composePrintPatientStrip({
    fullName: first.patientRef.fullName,
    sex: first.patientRef.sex,
    birthDate: first.patientRef.birthDate,
    phone: first.patientRef.phone,
    nationality: first.patientRef.nationality,
    date: bakuDateTimeDisplay(issuedAt),
    stay,
    roomNumber: roomNumber ?? stay.roomNumber,
  });

  return (
    <PrintShell
      lang={lang}
      branding={branding}
      patient={patient}
      title={printLabel(lang, "extraTicket")}
      autoPrint={sp.autoprint === "1"}
      paper="receipt"
      roomLabelKey="hotelRoom"
    >
      {copies.map((copyKey, idx) => (
        <Fragment key={copyKey}>
          {idx > 0 ? (
            <div className="mt-8 border-t border-black pt-6 print:break-before-page print:mt-0 print:border-0 print:pt-0" />
          ) : null}
          <p className="mb-2 text-xs font-semibold uppercase">{printLabel(lang, copyKey)}</p>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-black">
                <th className="p-1 text-left">{printLabel(lang, "no")}</th>
                <th className="p-1 text-left">{printLabel(lang, "procedureName")}</th>
                <th className="p-1 text-left">{printLabel(lang, "price")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row, i) => (
                <tr key={row.id} className="border-b border-black/30">
                  <td className="p-1">{i + 1}</td>
                  <td className="p-1">{resolveOrderDisplayName(row, catalogNames)}</td>
                  <td className="p-1">{Number(row.amountNet).toFixed(2)} AZN</td>
                </tr>
              ))}
              <tr>
                <td className="p-1 font-semibold" colSpan={2}>
                  {printLabel(lang, "total")}
                </td>
                <td className="p-1 font-semibold">{total.toFixed(2)} AZN</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 min-h-[18mm] w-full border border-black p-1 text-[10px]">
            {printLabel(lang, "signature")}
          </div>
          <p className="mt-2 break-all text-[9px]">{ticketId}</p>
        </Fragment>
      ))}
    </PrintShell>
  );
}
