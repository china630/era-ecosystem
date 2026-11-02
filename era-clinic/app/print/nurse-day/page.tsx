import { PrintShell } from "@/components/print/PrintShell";
import { buildNurseDayPrint } from "@/domain/print/print-nurse-day.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { enterPrintSession } from "@/domain/print/print-session";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { todayBakuYmd } from "@/lib/baku-day";

type Props = {
  searchParams: Promise<{
    lang?: string;
    autoprint?: string;
    date?: string;
    practitionerId?: string;
    mine?: string;
    patient?: string;
    procedure?: string;
  }>;
};

export default async function PrintNurseDayPage({ searchParams }: Props) {
  await enterPrintSession();
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  let practitionerId = sp.practitionerId?.trim() || null;
  if (!practitionerId && sp.mine === "1") {
    const session = await getSatelliteSession();
    const mine = session?.sub
      ? await prisma.practitioner.findFirst({
          where: { userId: session.sub },
          select: { id: true },
        })
      : null;
    practitionerId = mine?.id ?? null;
    if (!practitionerId) {
      const empty = await buildNurseDayPrint({
        lang,
        date: sp.date?.trim() || todayBakuYmd(),
        empty: true,
      });
      return (
        <PrintShell lang={lang} branding={empty.branding} title={printLabel(lang, "nurseDay")}>
          <p className="text-[11px]">{empty.titleDate}</p>
        </PrintShell>
      );
    }
  }
  const doc = await buildNurseDayPrint({
    lang,
    date: sp.date?.trim() || todayBakuYmd(),
    practitionerId,
    mine: sp.mine === "1",
    patient: sp.patient,
    procedure: sp.procedure,
  });

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      title={printLabel(lang, "nurseDay")}
      autoPrint={sp.autoprint === "1"}
    >
      <p className="mb-3 text-[11px]">
        <strong>{printLabel(lang, "date")}:</strong> {doc.titleDate}
        {" · "}
        <strong>{printLabel(lang, "staff")}:</strong> {doc.staffName}
      </p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="p-1 text-left">{printLabel(lang, "no")}</th>
            <th className="p-1 text-left">{printLabel(lang, "time")}</th>
            <th className="p-1 text-left">{printLabel(lang, "procedureName")}</th>
            <th className="p-1 text-left">{printLabel(lang, "patient")}</th>
            <th className="p-1 w-[34%] text-left">{printLabel(lang, "note")}</th>
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((row) => (
            <tr key={row.no} className="border-b border-neutral-300 align-top">
              <td className="p-1">{row.no}</td>
              <td className="p-1 whitespace-nowrap">{row.time}</td>
              <td className="p-1">{row.name}</td>
              <td className="p-1">{row.patient}</td>
              <td className="p-1">
                {row.zones ? <div>{row.zones}</div> : null}
                {row.settings ? <div className="mt-0.5">{row.settings}</div> : null}
                {row.note ? <div className="mt-0.5">{row.note}</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintShell>
  );
}
