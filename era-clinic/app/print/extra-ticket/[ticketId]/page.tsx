import { Fragment } from "react";
import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { loadExtraTicketPrint } from "@/domain/procedure/extra-ticket.service";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string }>;
};

const COPIES = ["copyReception", "copyNurse", "copyGuest"] as const;

export default async function PrintExtraTicketPage({ params, searchParams }: Props) {
  const { ticketId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const orders = await loadExtraTicketPrint(ticketId);
  if (!orders.length) notFound();
  const first = orders[0]!;
  const branding = await getPrintBranding(lang);
  const patient = {
    fullName: first.patientRef.fullName,
    sex: first.patientRef.sex,
    birthDate: first.patientRef.birthDate
      ? first.patientRef.birthDate.toISOString().slice(0, 10)
      : null,
    phone: first.patientRef.phone,
    nationality: first.patientRef.nationality,
    roomNumber: null,
    doctorName: null,
    date: new Date().toISOString().slice(0, 10),
  };

  return (
    <PrintShell
      lang={lang}
      branding={branding}
      patient={patient}
      title={printLabel(lang, "extraTicket")}
      autoPrint={sp.autoprint === "1"}
    >
      {COPIES.map((copyKey, idx) => (
        <Fragment key={copyKey}>
          {idx > 0 ? (
            <div className="mt-8 border-t border-black pt-6 print:break-before-page print:mt-0 print:border-0 print:pt-0" />
          ) : null}
          <p className="mb-2 text-xs font-semibold uppercase">{printLabel(lang, copyKey)}</p>
          <p className="mb-2 text-[10px]">
            {printLabel(lang, "ticketNo")}: {ticketId}
          </p>
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
                  <td className="p-1">{row.procedureName}</td>
                  <td className="p-1">{Number(row.amountNet).toFixed(2)} AZN</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-8 text-[10px]">{printLabel(lang, "signature")}: _______________</p>
        </Fragment>
      ))}
    </PrintShell>
  );
}
