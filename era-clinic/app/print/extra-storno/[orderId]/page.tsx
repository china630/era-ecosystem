import { Fragment } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { bakuDateTimeLabel } from "@/lib/baku-day";
import { composePrintPatientStrip, loadPrintEpisodeStay } from "@/domain/print/print-patient-strip";
import {
  loadCatalogDisplayNameMap,
  resolveOrderDisplayName,
} from "@/domain/catalog/catalog-display-name.service";
import { prisma } from "@/lib/prisma";
import { enterRequestTenant } from "@/lib/request-organization";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{
    organizationId?: string;
    lang?: string;
    autoprint?: string;
    sheets?: string;
    copy?: string;
  }>;
};

const COPIES = ["copyReception", "copyNurse", "copyGuest"] as const;

export default async function PrintExtraStornoPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const organizationId = sp.organizationId?.trim();
  if (!organizationId) notFound();
  const sessionOrganizationId = (await headers()).get("x-era-organization-id")?.trim();
  if (sessionOrganizationId !== organizationId) notFound();
  enterRequestTenant(organizationId);
  const order = await prisma.procedureOrder.findFirst({
    where: { id: orderId, organizationId, status: "CANCELLED", inPackage: false },
    include: { patientRef: true, clinicalEpisode: { select: { roomNumber: true } } },
  });
  if (!order?.paymentReceiptRef) notFound();
  const branding = await getPrintBranding(lang);
  const sheetCount = sp.sheets === "1" ? 1 : COPIES.length;
  const copyIdx = Math.min(Math.max(0, Number(sp.copy ?? "1") - 1), COPIES.length - 1);
  const copies: Array<(typeof COPIES)[number]> =
    sheetCount === 1 ? [COPIES[copyIdx]!] : [...COPIES];
  const catalogNames = await loadCatalogDisplayNameMap([order.procedureCode], lang);
  const stay = await loadPrintEpisodeStay({
    episodeId: order.clinicalEpisodeId,
    patientRefId: order.patientRefId,
  });
  const patient = composePrintPatientStrip({
    fullName: order.patientRef.fullName,
    sex: order.patientRef.sex,
    birthDate: order.patientRef.birthDate,
    phone: order.patientRef.phone,
    nationality: order.patientRef.nationality,
    date: bakuDateTimeLabel(order.scheduledAt),
    stay,
    roomNumber: order.clinicalEpisode?.roomNumber ?? stay.roomNumber,
  });

  return (
    <PrintShell
      lang={lang}
      branding={branding}
      patient={patient}
      title={printLabel(lang, "stornoTitle")}
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
          <p className="mb-2 text-[11px]">{printLabel(lang, "stornoNote")}</p>
          <table className="w-full border-collapse text-[10px]">
            <tbody>
              <tr className="border-b border-black/30">
                <td className="p-1">{printLabel(lang, "ticketNo")}</td>
                <td className="p-1">{order.paymentReceiptRef}</td>
              </tr>
              <tr className="border-b border-black/30">
                <td className="p-1">{printLabel(lang, "procedureName")}</td>
                <td className="p-1">{resolveOrderDisplayName(order, catalogNames)}</td>
              </tr>
              <tr className="border-b border-black/30">
                <td className="p-1">{printLabel(lang, "time")}</td>
                <td className="p-1">{bakuDateTimeLabel(order.scheduledAt)}</td>
              </tr>
              <tr className="border-b border-black/30">
                <td className="p-1">{printLabel(lang, "price")}</td>
                <td className="p-1">-{Number(order.amountNet).toFixed(2)} AZN</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 min-h-[18mm] w-full border border-black p-1 text-[10px]">
            {printLabel(lang, "signature")}
          </div>
        </Fragment>
      ))}
    </PrintShell>
  );
}
